data "aws_caller_identity" "current" {}

data "aws_ecr_authorization_token" "token" {
  registry_id = data.aws_caller_identity.current.account_id
}

provider "docker" {
  registry_auth {
    address  = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.aws_region}.amazonaws.com"
    username = data.aws_ecr_authorization_token.token.user_name
    password = data.aws_ecr_authorization_token.token.password
  }
}

module "lambda_function" {
  source = "terraform-aws-modules/lambda/aws"

  function_name  = "atlas-worker"
  create_package = false

  image_uri    = module.docker_image.image_uri
  package_type = "Image"

  timeout     = var.lambda_timeout # 15 minutes
  memory_size = var.lambda_memory  # 1GB

  environment_variables = {
    PG_WRITE_URL   = var.pg_write_url
    S3_ACCESS_KEY  = var.s3_access_key
    S3_SECRET_KEY  = var.s3_secret_key
    S3_ENDPOINT    = var.s3_endpoint
    S3_BUCKET_NAME = var.s3_bucket_name
    ARGO_DAC       = var.argo_dac
  }
}

module "docker_image" {
  source = "terraform-aws-modules/lambda/aws//modules/docker-build"

  create_ecr_repo = true
  ecr_repo        = "atlas-worker"

  use_image_tag = true
  image_tag     = var.image_tag

  source_path = "../apps/workers"
  # build_args      = {
  #   FOO = "bar"
  # }
}

module "eventbridge" {
  source  = "terraform-aws-modules/eventbridge/aws"
  version = "4.2.2"

  create_bus = false

  rules = {
    weekly_sync = {
      description         = "Trigger ARGO float weekly sync"
      schedule_expression = var.schedule_expression
    }
  }

  # Connect Lambda as target
  targets = {
    weekly_sync = [
      {
        name  = "atlas-worker-lambda"
        arn   = module.lambda_function.lambda_function_arn
        input = jsonencode({ operation = "update" })
      }
    ]
  }

  # IAM permissions for EventBridge to invoke Lambda
  attach_lambda_policy = true
  lambda_target_arns   = [module.lambda_function.lambda_function_arn]

  tags = {
    Name = "atlas-worker-scheduler"
  }
}
