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
