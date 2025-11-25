import awsLambdaFastify from '@fastify/aws-lambda';
import Fastify from 'fastify';
import { app, options } from './lambda-app';

// Create Fastify instance
const fastify = Fastify(options);

// Register the app
fastify.register(app);

// Initialize the Fastify app wrapper for AWS Lambda
const proxy = awsLambdaFastify(fastify);

// Lambda handler
export const handler = async (event: any, context: any) => {
  return await proxy(event, context);
};
