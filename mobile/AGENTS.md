# TidyNext no iPhone

Este diretório é o app nativo instalado pelo Xcode. A tela abre direto no iPhone, sem WebView. Não publique um endereço.

No Mac, a partir desta pasta, com o iPhone conectado:

```bash
bash install-iphone.sh
```

Isso gera `ios/*.xcworkspace` e abre o Xcode. Escolha o Team, o iPhone, e aperte Run. Não rode esses comandos na raiz de outro repositório.

O identificador é `com.tidynext.home`. A câmera e a biblioteca pedem permissão só neste aparelho.
