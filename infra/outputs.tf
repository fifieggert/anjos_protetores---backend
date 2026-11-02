# Valores exibidos no fim do "terraform apply" (e depois com "terraform output").
# Nenhum output mostra segredo: senhas e DATABASE_URL ficam só no SSM Parameter Store.
# Para ler um segredo: aws ssm get-parameter --name /anjos/jwt_secret --with-decryption

output "elastic_ip" {
  description = "IP fixo do servidor. Crie no Registro.br um registro A apontando o domínio para ele."
  value       = aws_eip.app.public_ip
}

output "registro_dns" {
  description = "Registros que devem ser criados no Registro.br."
  value = {
    "${var.domain}"     = "A ${aws_eip.app.public_ip}"
    "www.${var.domain}" = "A ${aws_eip.app.public_ip}"
  }
}

output "rds_endpoint" {
  description = "Endereço do banco (host:porta). Só é acessível de dentro da VPC, pela EC2."
  value       = aws_db_instance.banco.endpoint
}

output "ecr_backend_url" {
  description = "URL do repositório de imagens do backend (usada no docker push/pull)."
  value       = aws_ecr_repository.app["backend"].repository_url
}

output "ecr_frontend_url" {
  description = "URL do repositório de imagens do frontend."
  value       = aws_ecr_repository.app["frontend"].repository_url
}

output "github_actions_role_arn" {
  description = "ARN da role que os workflows do GitHub assumem (input role-to-assume do configure-aws-credentials)."
  value       = aws_iam_role.github_actions.arn
}

output "instance_id" {
  description = "ID da EC2 (alvo do SSM SendCommand no deploy)."
  value       = aws_instance.app.id
}

output "ssm_parametros" {
  description = "Nomes (não os valores) dos parâmetros com os segredos."
  value = [
    aws_ssm_parameter.db_password.name,
    aws_ssm_parameter.jwt_secret.name,
    aws_ssm_parameter.database_url.name,
  ]
}

output "comando_ssm_sessao" {
  description = "Comando para abrir um terminal na EC2 sem SSH (precisa do Session Manager plugin)."
  value       = "aws ssm start-session --target ${aws_instance.app.id} --region ${var.region}"
}
