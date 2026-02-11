import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import { Construct } from 'constructs';

export interface FrontendStackProps {
  apiEndpoint: string;
  userPoolId: string;
  userPoolClientId: string;
  customDomain?: string;
  certificateArn?: string;
}

/**
 * Frontend stack - S3 bucket and CloudFront distribution for React app
 */
export class FrontendStack extends Construct {
  public readonly bucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;
  public readonly distributionUrl: string;

  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id);

    // S3 bucket for static website hosting
    this.bucket = new s3.Bucket(this, 'FrontendBucket', {
      bucketName: `secrets-portal-frontend-${cdk.Stack.of(this).account}-${cdk.Stack.of(this).region}`,
      publicReadAccess: false, // CloudFront will access via OAI
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN, // Keep bucket on stack deletion
      autoDeleteObjects: false,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
      lifecycleRules: [
        {
          noncurrentVersionExpiration: cdk.Duration.days(30),
        },
      ],
    });

    // Origin Access Identity for CloudFront
    const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'OAI', {
      comment: 'OAI for Secrets Portal Frontend',
    });

    // Grant CloudFront read access to S3 bucket
    this.bucket.grantRead(originAccessIdentity);

    // CloudFront distribution configuration
    let distributionProps: cloudfront.DistributionProps = {
      defaultBehavior: {
        origin: new origins.S3Origin(this.bucket, {
          originAccessIdentity,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
        compress: true,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
      ],
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100, // Use only North America and Europe
      enabled: true,
      comment: 'Secrets Portal Frontend Distribution',
    };

    // Add custom domain and certificate if provided
    if (props.customDomain && props.certificateArn) {
      const certificate = acm.Certificate.fromCertificateArn(
        this,
        'Certificate',
        props.certificateArn
      );
      distributionProps = {
        ...distributionProps,
        domainNames: [props.customDomain],
        certificate: certificate,
      };
    }

    // Create CloudFront distribution
    this.distribution = new cloudfront.Distribution(this, 'Distribution', distributionProps);

    this.distributionUrl = `https://${this.distribution.distributionDomainName}`;

    // Output distribution URL
    new cdk.CfnOutput(scope, 'FrontendUrl', {
      value: this.distributionUrl,
      description: 'CloudFront distribution URL for frontend',
    });

    new cdk.CfnOutput(scope, 'FrontendBucketName', {
      value: this.bucket.bucketName,
      description: 'S3 bucket name for frontend assets',
    });

    new cdk.CfnOutput(scope, 'DistributionId', {
      value: this.distribution.distributionId,
      description: 'CloudFront distribution ID',
    });

    // Output frontend configuration for build
    new cdk.CfnOutput(scope, 'FrontendConfig', {
      value: JSON.stringify({
        apiEndpoint: props.apiEndpoint,
        userPoolId: props.userPoolId,
        userPoolClientId: props.userPoolClientId,
        region: cdk.Stack.of(this).region,
      }),
      description: 'Frontend configuration (use for .env file)',
    });
  }

  /**
   * Deploy frontend assets to S3 and invalidate CloudFront cache
   * This should be called after the distribution is created
   */
  public deployAssets(sourcePath: string): s3deploy.BucketDeployment {
    return new s3deploy.BucketDeployment(this, 'DeployFrontend', {
      sources: [s3deploy.Source.asset(sourcePath)],
      destinationBucket: this.bucket,
      distribution: this.distribution,
      distributionPaths: ['/*'],
      prune: true, // Remove old files
      memoryLimit: 512,
    });
  }
}
