
# Deploying Athena Data Source using CDK

In this tutorial, we look at how to deploy the lambda connector for a MySQL data source and then configure Athena to this MySQL data source using AWS CDK. Similar steps can be followed to connect Athena with other external data sources (such as OpenSearch).


## Pre-requisites

For the purpose of this tutorial, we assume that a MySQL instance is already hosted on AWS RDS and the user credentials are stored in AWS SecretsManager with secret name: `AthenaMySQLFederation/DB/credentials` (The name just has to start with the given SecretNamePrefix. In our case the SecretNamePrefix is `AthenaMySQLFederation`). The secret should be stored in the following format:

```
{"username": "${username}", "password": "${password}"}
```

We also assume that the following values are already known:\
    1. VPC ID (corresponding to the DB hosted on RDS)\
    2.	Subnet ID (corresponding to the DB hosted on RDS)\
    3.	DB Endpoint, DB Port


## Step - 1: Configure a Security Group for Connector Lambda

We can either use an existing security group or create a new security group for our connector lambda. In this tutorial, we create a new security group in our given VPC (same as DB). For simplicity we allow all inbound and outbound traffic. The CDK code for creating and configuring the new security group in the given VPC is:

```ts
// get VPC from given VPC ID
const vpc = ec2.Vpc.fromLookup(this, 'VPC', {
  vpcId: [VPC_ID]
})

// create a new security group
let mySecurityGroup = new ec2.SecurityGroup(this, 'NewSecurityGroup', {
  description: 'sg for athena lambda connector',
  vpc: vpc,
  allowAllOutbound: true
});

// add inbound rule
mySecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.allTraffic(), 'allow all inbound')
```

## Step - 2: Create an S3 Spill Bucket

We create a new S3 bucket which will act as the spill bucket to store data that exceeds the lambda’s payload limit.

```typescript
let spillBucket = new Bucket(this, "AthenaFederatedSpill");
```

## Step - 3: Create the Lambda Connector Function

We create the lambda connector app from an application template available in AWS Serverless Application Repository called AthenaMySQLConnector. We use the Application ID (ARN) and version number for this application template. Here we also assume the default database for our DB instance is test_db. The CDK code to create the lambda function is as follows:

```ts
let connectorApp = new CfnApplication(this, "MyDB", {
      location: {
          applicationId: "arn:aws:serverlessrepo:us-east-1:292517598671:applications/AthenaMySQLConnector",
          semanticVersion: "2023.14.1"
      },
      parameters: {
          DefaultConnectionString: `mysql://jdbc:mysql://[DB_ENDPOINT]:[DB_PORT_NO]/test_db?${AthenaMySQLFederation/DB/credentials}`,
          LambdaFunctionName: "athena-mysql-connector",
          SecretNamePrefix: `AthenaMySQLFederation`,
          SecurityGroupIds: mySecurityGroup.securityGroupId,
          SpillBucket: spillBucket.bucketName,
          SubnetIds: [SUBNET_ID(s)]
      }
  })
```

## Step - 4: Create Athena Datasource with Lambda Connector

Since the connector lambda is created, we can create an Athena Datasource with the lambda as the connector. The code to create the MySQL data source is as follows:
```ts
// get the lambda app created by its funciton name; we need the arn of this function
const lambdaApp = lambda.Function.fromFunctionName(this,"connector-lambda", "athena-mysql-connector")

// create the data source
let athenaDs = new aws_athena.CfnDataCatalog(this, "athena-datasource-cdk", {
  name: "athena-mysql-ds",
  type: "LAMBDA",
  description: "MySQL datasource",
  parameters: {
    function: lambdaApp.functionArn
  }
})
```

### Considerations - Permissions and Access

It is important to ensure that VPC where the lambda is deployed has access to both the S3 and SecretsManager services. Often times, the access to both the services are not present and have to be configured separately by creating Endpoints from the VPC to the services. Refer to [1] and [2] for more details on how create endpoints to S3 and SecretsManager.

## References
[1] [Gateway endpoints for Amazon S3 - Amazon Virtual Private Cloud]()\
[2] [Troubleshoot the "Unable to execute HTTP request.... connect timed out" error in AWS Glue | AWS re:Post (repost.aws)]()

