# この段階で作るのは EC2 1 台である。
# アプリは infra/ec2/setup.sh で載せる。中では Wrangler が Hono と Durable Object の SQLite を動かす。
# 読書の記録は SQLite のままである。RDS は確認用で、5432 は EC2 からだけ入れる。
# 外から入れるポートは、この PC からの 22（SSH）と 80 だけである。
# 2026年10月26日に起動した。再適用は、指示があるまで実行しない。

data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }

  filter {
    name   = "default-for-az"
    values = ["true"]
  }
}

data "aws_ami" "amazon_linux_2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-2023.*-kernel-*-arm64"]
  }

  filter {
    name   = "architecture"
    values = ["arm64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

resource "aws_security_group" "reading_log" {
  name        = "reading-log-ec2"
  description = "Reading log EC2. Inbound is this PC only, on 22 and 80."
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "SSH from this PC"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.allowed_cidr]
  }

  ingress {
    description = "nginx from this PC"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = [var.allowed_cidr]
  }

  # これはサーバから外へ出る向きである。パッケージの取得と SSM のために残す。
  # 外から入る接続は、上の 22 と 80 だけである。
  egress {
    description = "Outbound for packages and SSM"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "reading-log-ec2"
  }
}

resource "aws_iam_role" "reading_log" {
  name = "reading-log-ec2"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.reading_log.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "reading_log" {
  name = "reading-log-ec2"
  role = aws_iam_role.reading_log.name
}

resource "aws_key_pair" "reading_log" {
  key_name   = "reading-log-ec2"
  public_key = file("${path.module}/keys/reading-log.pub")
}

resource "aws_instance" "reading_log" {
  ami                         = data.aws_ami.amazon_linux_2023.id
  instance_type               = var.instance_type
  subnet_id                   = sort(data.aws_subnets.default.ids)[0]
  vpc_security_group_ids      = [aws_security_group.reading_log.id]
  iam_instance_profile        = aws_iam_instance_profile.reading_log.name
  key_name                    = aws_key_pair.reading_log.key_name
  associate_public_ip_address = true

  credit_specification {
    cpu_credits = "standard"
  }

  metadata_options {
    http_tokens = "required"
  }

  root_block_device {
    volume_type = "gp3"
    volume_size = 8
    encrypted   = true
  }

  tags = {
    Name = "reading-log"
  }
}
