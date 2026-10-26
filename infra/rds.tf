# PostgreSQL は公開しない。5432 は EC2 のセキュリティグループからだけ許可する。

resource "aws_db_subnet_group" "reading_log" {
  name       = "reading-log"
  subnet_ids = data.aws_subnets.default.ids

  tags = {
    Name = "reading-log"
  }
}

resource "aws_security_group" "reading_log_db" {
  name        = "reading-log-db"
  description = "PostgreSQL from the reading log EC2 only."
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description     = "PostgreSQL from reading log EC2"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.reading_log.id]
  }

  tags = {
    Name = "reading-log-db"
  }
}

resource "aws_db_instance" "reading_log" {
  identifier     = "reading-log"
  engine         = "postgres"
  engine_version = "16.15"
  instance_class = "db.t4g.micro"

  allocated_storage = 20
  storage_type      = "gp3"
  storage_encrypted = true

  db_name  = var.db_name
  username = var.db_username
  password = var.db_password

  db_subnet_group_name   = aws_db_subnet_group.reading_log.name
  vpc_security_group_ids = [aws_security_group.reading_log_db.id]
  publicly_accessible    = false
  multi_az               = false

  backup_retention_period      = 1
  skip_final_snapshot          = true
  deletion_protection          = false
  performance_insights_enabled = false

  tags = {
    Name = "reading-log"
  }
}
