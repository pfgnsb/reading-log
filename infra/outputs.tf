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

output "db_endpoint" {
  description = "EC2 から接続する RDS のホスト名。公開アドレスはない。"
  value       = aws_db_instance.reading_log.address
}

output "db_name" {
  description = "RDS のデータベース名。"
  value       = aws_db_instance.reading_log.db_name
}
