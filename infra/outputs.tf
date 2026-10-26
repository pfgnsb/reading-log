output "instance_id" {
  description = "動作確認で指定するインスタンス ID。"
  value       = aws_instance.reading_log.id
}

output "availability_zone" {
  description = "インスタンスを置いたアベイラビリティゾーン。"
  value       = aws_instance.reading_log.availability_zone
}

output "public_ip" {
  description = "自動で付く公開アドレス。インスタンスを止めると外れる。"
  value       = aws_instance.reading_log.public_ip
}
