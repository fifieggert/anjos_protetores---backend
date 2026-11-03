# Painel da coordenação (dashboard)

Endpoint que alimenta a tela inicial do sistema interno: números do abrigo e listas curtas
do que precisa de atenção.

> Os valores de exemplo deste documento são **falsos**.

## `GET /api/dashboard`

| | |
|---|---|
| Acesso | Somente perfil **ADMIN** |
| Sem token | `401 {"error": "Token não informado."}` |
| Perfil VOLUNTARIO | `403 {"error": "Você não tem permissão para acessar este recurso."}` |
| Sucesso | `200` com o JSON abaixo e `Cache-Control: no-store` (dados internos não ficam guardados no navegador) |
| Parâmetros | Nenhum |

### Resposta

```json
{
  "animais": {
    "total": 20,
    "porStatus": { "DISPONIVEL": 7, "EM_TRATAMENTO": 0, "EM_ESPERA": 1, "ADOTADO": 12 },
    "porEspecie": [
      { "especie": "CACHORRO", "total": 12 },
      { "especie": "GATO", "total": 8 },
      { "especie": "OUTRO", "total": 0 }
    ]
  },
  "adocoes": {
    "pendentes": 3,
    "emContato": 2,
    "concluidasNoMes": 2,
    "concluidasTotal": 40,
    "porMes": [
      { "mes": "2026-05", "total": 0 },
      { "mes": "2026-06", "total": 4 },
      { "mes": "2026-07", "total": 0 },
      { "mes": "2026-08", "total": 0 },
      { "mes": "2026-09", "total": 1 },
      { "mes": "2026-10", "total": 2 }
    ]
  },
  "estoque": {
    "itensAbaixoDoMinimo": 7,
    "itens": [
      { "id": "…", "nomeItem": "Areia", "quantidadeAtual": 0, "quantidadeMinima": 20 },
      { "id": "…", "nomeItem": "Vermífugo", "quantidadeAtual": 0, "quantidadeMinima": 2 }
    ]
  },
  "doacoes": {
    "totalNoMes": 14,
    "recentes": [
      {
        "id": "…",
        "quantidade": 10,
        "doador": "Mercado Exemplo",
        "dataEntrada": "2026-10-24T13:00:00.000Z",
        "item": { "id": "…", "nomeItem": "Ração adulto", "categoria": "RACAO" }
      }
    ]
  },
  "eventos": {
    "proximos": [
      {
        "id": "…",
        "titulo": "Feira de adoção",
        "descricao": null,
        "data": "2026-11-14",
        "horarioInicio": "09:00",
        "horarioFim": "12:00",
        "local": "Praça Central",
        "imagemUrl": null
      }
    ]
  }
}
```

### Regras de cada campo

| Campo | Regra |
|---|---|
| `animais.total` | Todos os animais cadastrados (soma de `porStatus`) |
| `animais.porStatus` | Todos os status do enum `StatusAnimal`, com `0` quando não houver animal |
| `animais.porEspecie` | Todas as espécies do enum `Especie`, na ordem do enum, com `0` quando não houver |
| `adocoes.pendentes` / `emContato` | Solicitações de adoção com status `PENDENTE` / `EM_CONTATO` |
| `adocoes.concluidasTotal` | Solicitações `APROVADA` (adoção concluída pela coordenação) |
| `adocoes.concluidasNoMes` | Solicitações aprovadas no mês atual (igual ao último item de `porMes`) |
| `adocoes.porMes` | Os **últimos 6 meses, incluindo o atual**, do mais antigo ao mais novo, com `0` nos meses sem adoção. `mes` no formato `AAAA-MM` |
| `estoque.itensAbaixoDoMinimo` | Itens em alerta, com a mesma regra de `GET /api/itens-estoque/alertas`: mínimo maior que 0 e saldo atual abaixo do mínimo |
| `estoque.itens` | Até **5** itens em alerta, os mais críticos primeiro: menor proporção saldo/mínimo; no empate, menor saldo e depois ordem alfabética |
| `doacoes.totalNoMes` | Quantidade de **registros** de doação com data de entrada no mês atual (não é a soma das quantidades) |
| `doacoes.recentes` | Até **5** doações, da mais recente para a mais antiga, com o item doado. Não inclui o usuário que registrou (CPF e e-mail) |
| `eventos.proximos` | Até **5** eventos de hoje em diante, do mais próximo ao mais distante (mesma regra do site público e de `GET /api/eventos?periodo=proximos`). Mesmos campos do site público; `data` como `AAAA-MM-DD` |

### Mês e fuso horário

"Mês" é o mês do calendário **em Brasília (UTC-3)**, não o do servidor. Por exemplo, uma
adoção concluída às 23h30 de 31/10 em Brasília (02h30 de 01/11 em UTC) conta em outubro.
O cálculo fica em `src/utils/meses.ts`, com deslocamento fixo de 3 horas (o Brasil não tem
horário de verão desde 2019).

A data de conclusão de uma adoção é o `atualizadoEm` da solicitação aprovada: depois de
aprovada, a solicitação não é mais alterada.

### Privacidade

O painel não devolve nome nem telefone de interessados em adoção: das solicitações, só
são feitas contagens. Das doações sai o nome do doador (que a coordenação já vê em
`GET /api/doacoes`), mas não os dados do usuário que registrou.

### Desempenho

O service (`src/service/dashboardService.ts`) dispara todas as consultas ao mesmo tempo
(`Promise.all`). Os números são contagens feitas no banco (`count` e `groupBy`); nenhuma
tabela é carregada inteira. As únicas listas lidas são as de no máximo 5 linhas e a dos
itens em alerta (só os que estão abaixo do mínimo, como em `/itens-estoque/alertas`).

## Arquivos

| Camada | Arquivo |
|---|---|
| Rota | `src/routes/dashboardRoutes.ts` (registrada em `src/routes/index.ts` como `/dashboard`) |
| Controller | `src/controller/dashboardController.ts` |
| Service | `src/service/dashboardService.ts` |
| Repository | `src/repository/dashboardRepository.ts` (eventos reaproveitam `eventoRepository.findPublicos`) |
| Helper de meses | `src/utils/meses.ts` |
| Testes | `src/__tests__/service/dashboardService.test.ts`, `src/__tests__/routes/dashboard.routes.test.ts`, `src/__tests__/utils/meses.test.ts` |
