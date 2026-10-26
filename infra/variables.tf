variable "instance_type" {
  description = "動作確認用の EC2。無料枠で使える t4g.small（2GB）を初期値にする。"
  type        = string
  default     = "t4g.small"
}

variable "allowed_cidr" {
  description = "入ってくる接続を許すアドレス。この PC の公開アドレスを /32 で書く。値は terraform.tfvars に置く。"
  type        = string

  validation {
    condition     = can(cidrhost(var.allowed_cidr, 0)) && endswith(var.allowed_cidr, "/32")
    error_message = "この PC の公開アドレスを /32 で書いてください。"
  }
}
