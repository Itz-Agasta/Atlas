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
    supabase = {
      source  = "supabase/supabase"
      version = "1.6.1"
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

provider "supabase" {
  access_token = var.supabase_provider_token
}