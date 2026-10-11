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

## Instalar só no seu iPhone

O app em `mobile/` é uma tela nativa, instalada pelo Xcode no iPhone ligado ao seu Mac. Ele não abre uma página web e não publica um endereço. A foto, o plano, os pontos e o relógio ficam nesse aparelho.

A pasta `mobile` existe neste branch (`cursor/refine-photo-task-flow-ad85`). Ela não está na pasta de outro projeto, como Lumacare. No Mac, com o iPhone desbloqueado, o cabo conectado e o modo de desenvolvedor ligado:

```bash
git clone -b cursor/refine-photo-task-flow-ad85 https://github.com/rmagalhaes90/Fixyourhome.git
cd Fixyourhome/mobile
bash install-iphone.sh
```

Se o repositório já estiver no Mac, entre nele, atualize esse branch e rode o mesmo script:

```bash
cd /caminho/do/Fixyourhome
git fetch origin
git checkout cursor/refine-photo-task-flow-ad85
git pull origin cursor/refine-photo-task-flow-ad85
bash mobile/install-iphone.sh
```

O script instala as dependências, gera o projeto do Xcode e instala no iPhone. Na primeira vez, o Xcode pede a sua conta Apple para assinar `com.tidynext.home`. Escolha o iPhone na lista. O ícone TidyNext aparece na tela inicial.

Para atualizar a tela empacotada depois de mudar o app web:

```bash
npm run bundle:iphone
```

Depois rode de novo `bash mobile/install-iphone.sh`.

## Executar localmente

```bash
npm install
npm run dev
```

## Próximas integrações

A arquitetura está pronta para receber análise visual real, autenticação, histórico persistente, assinaturas, créditos de IA e anúncios recompensados.

> Nunca coloque chaves de IA, Firebase, RevenueCat ou AdMob diretamente no código versionado. Use variáveis de ambiente.
