# Lambda Function Outputs
output "lambda_function_arn" {
  description = "ARN of the Lambda function"
  value       = module.lambda_function.lambda_function_arn
}

output "lambda_function_name" {
  description = "Name of the Lambda function"
  value       = module.lambda_function.lambda_function_name
}

output "lambda_function_invoke_arn" {
  description = "Invoke ARN of the Lambda function"
  value       = module.lambda_function.lambda_function_invoke_arn
}

# ECR Repository Outputs
output "ecr_repository_url" {
  description = "URL of the ECR repository"
  value       = module.docker_image.image_uri
}

# EventBridge Outputs
output "eventbridge_rule_arn" {
  description = "ARN of the EventBridge rule"
  value       = module.eventbridge.eventbridge_rule_arns
}

output "eventbridge_rule_ids" {
  description = "IDs of the EventBridge rules"
  value       = module.eventbridge.eventbridge_rule_ids
}
