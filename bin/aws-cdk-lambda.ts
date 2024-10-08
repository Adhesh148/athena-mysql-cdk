#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { AwsCdkLambdaStack } from '../lib/aws-cdk-lambda-stack';

const app = new cdk.App();
new AwsCdkLambdaStack(app, 'AwsCdkLambdaStack', { env: {
    account: '793852398767',
    region: 'us-east-1' // or whatever region you use
  }});
