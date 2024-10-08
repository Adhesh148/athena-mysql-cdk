import { aws_athena, Stack, StackProps } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { CfnApplication } from 'aws-cdk-lib/aws-sam';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

import { Construct } from 'constructs';

export class AwsCdkLambdaStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // const hello = new lambda.Function(this, 'Hello Handler', {
    //   runtime: lambda.Runtime.PYTHON_3_9,
    //   code: lambda.Code.fromAsset('lambda'),
    //   handler: 'hello.handler',
    //   functionName: 'HelloLambda'
    // })

    // get existing vpc
    const vpc = ec2.Vpc.fromLookup(this, 'VPC', {
      vpcId: 'vpc-003cf21b3b23d45c9'
    })

    let mySecurityGroup = new ec2.SecurityGroup(this, 'NewSecurityGroup', {
      description: 'sg for athena lambda connector',
      vpc: vpc,
      allowAllOutbound: true
    });
    mySecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.allTraffic(), 'allow all inbound')

    let spillBucket = new Bucket(this, "AthenaFederatedSpill");

    let serverlessrepoApplication = new CfnApplication(this, "MyDB", {
      location: {
        applicationId: "arn:aws:serverlessrepo:us-east-1:292517598671:applications/AthenaMySQLConnector",
        semanticVersion: "2023.14.1"
      },
      parameters: {
        DefaultConnectionString: `mysql://jdbc:mysql://test-db.cujh1cewjarc.us-east-1.rds.amazonaws.com:3306/test_db?user=admin&password=123_Phoenix`,
        LambdaFunctionName: "athena-mysql-connector",
        SecretNamePrefix: `AthenaMySQLFederation`,
        SecurityGroupIds: mySecurityGroup.securityGroupId,
        SpillBucket: spillBucket.bucketName,
        SubnetIds: 'subnet-06e15f21f40dd64fd'
      }
    })

    const connectorLambda = lambda.Function.fromFunctionName(this, "connector-lambda", "athena-mysql-connector")

    let athenaDs = new aws_athena.CfnDataCatalog(this, "athena-datasource-cdk", {
      name: "athena-mysql-ds",
      type: "LAMBDA",
      description: "athena mysql ds",
      parameters: {
        function: connectorLambda.functionArn
      }
    })

  }
}
