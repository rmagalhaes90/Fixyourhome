# Fix Your Home — TidyNext AI

Aplicativo mobile-first que transforma uma foto da bagunça em um plano simples de organização, executado uma tarefa por vez.

## MVP atual

- captura ou upload de foto do cômodo;
- modos rápido, normal e profundo;
- leitura da foto neste aparelho (luz, ocupação, cor e chão) para montar a lista;
- plano de organização com horário de início e de término;
- modo de limpeza passo a passo, com afirmação e pontos a cada tarefa;
- relógio, tempo decorrido, tempo restante e conclusão;
- comparação antes/depois e Room Score;
- layout responsivo para celular e web.

## Conta, IA e banco

Cada pessoa entra com Google ou Apple. O primeiro acesso cria a conta. O banco guarda o nome, o e-mail, o provedor, cada plano e cada reset. A foto é enviada só para a análise e não fica salva.

Variáveis de ambiente, nunca no código:

- `OPENAI_API_KEY` e, se quiser, `OPENAI_MODEL` (padrão `gpt-4o-mini`)
- `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`
- `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID` e `APPLE_PRIVATE_KEY`

URLs de retorno:

- `/api/auth/google/callback`
- `/api/auth/apple/callback`

Sem a chave de IA, o plano continua sendo montado pela leitura da foto neste aparelho e essa leitura também fica registrada na conta.

## Instalar no celular

O TidyNext abre como um site e pode ficar na tela inicial, com ícone e nome próprios.

1. Abra o endereço publicado no celular.
2. No iPhone, use o Safari: Compartilhar → Adicionar à Tela de Início.
3. No Android, use o Chrome e toque em Instalar. A tela inicial do app também mostra esse caminho.

## Executar localmente

```bash
npm install
npm run dev
```

## Próximas integrações

A arquitetura está pronta para receber análise visual real, autenticação, histórico persistente, assinaturas, créditos de IA e anúncios recompensados.

> Nunca coloque chaves de IA, Firebase, RevenueCat ou AdMob diretamente no código versionado. Use variáveis de ambiente.
