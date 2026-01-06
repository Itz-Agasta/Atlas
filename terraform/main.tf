terraform {
  cloud {
    organization = "vyse"
    workspaces {
      name = "atlas-infra"
    }
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 3.0"
    }
  }
  required_version = ">=1.2"
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      project     = var.project_name
      Environment = var.environment
      ManagedBY   = "Terraform"
    }
  }
}