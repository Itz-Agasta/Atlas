# Define a linked project variable as input
import {
  to = supabase_project.production
  id = var.linked_project
}

# Import existing Supabase project
resource "supabase_project" "production" {
  organization_id   = var.organization_id
  name              = "Atlas"
  database_password = var.database_password
  region            = var.region

  lifecycle {
    ignore_changes = [database_password]
  }
}

