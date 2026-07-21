# 🚀 Guia de Deploy — Radical Capacetes (Firebase + Vercel)

## Pré-requisitos

- [x] Node.js 18+ instalado
- [ ] Conta no [Firebase](https://console.firebase.google.com)
- [ ] Conta no [Vercel](https://vercel.com)
- [ ] Vercel CLI: `npm install -g vercel`

---

## Passo 1 — Configurar o Firebase

### 1.1 Criar projeto Firebase
1. Acesse https://console.firebase.google.com
2. Clique em **"Adicionar projeto"** → dê um nome (ex: `radical-capacetes`)
3. Desative o Google Analytics se não precisar → **Criar projeto**

### 1.2 Ativar o Firestore
1. No menu lateral, vá em **Firestore Database**
2. Clique em **"Criar banco de dados"**
3. Escolha o modo **Produção** (ou Teste para desenvolver)
4. Selecione a região `southamerica-east1` (São Paulo) → **Concluído**

### 1.3 Obter as credenciais de Admin
1. Vá em **Configurações do Projeto** (ícone de engrenagem) → **Contas de Serviço**
2. Clique em **"Gerar nova chave privada"** → baixa um arquivo JSON
3. Abra esse arquivo JSON — você vai precisar de:
   - `project_id`
   - `client_email`
   - `private_key`

### 1.4 Preencher o `.env.local`
Edite o arquivo `.env.local` na raiz do projeto:
```env
FIREBASE_PROJECT_ID=seu-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@seu-projeto.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nABC123...\n-----END PRIVATE KEY-----\n"
```

> NUNCA envie o `.env.local` ou o arquivo JSON de credenciais para o Git!
> Eles já estão no `.gitignore`.

---

## Passo 2 — Migrar os dados existentes

Com o `.env.local` preenchido, rode:

```bash
npm run migrate
```

Isso vai importar todos os eventos e vendas dos arquivos JSON locais para o Firestore.

---

## Passo 3 — Testar localmente com Vercel Dev

```bash
npm install -g vercel
vercel dev
```

Acesse http://localhost:3000 e verifique se tudo funciona corretamente.

---

## Passo 4 — Deploy no Vercel

### 4.1 Fazer login no Vercel
```bash
vercel login
```

### 4.2 Configurar variáveis de ambiente no Vercel
```bash
vercel env add FIREBASE_PROJECT_ID
vercel env add FIREBASE_CLIENT_EMAIL
vercel env add FIREBASE_PRIVATE_KEY
vercel env add GEMINI_API_KEY
```

Para cada variável, o CLI vai pedir o valor. Cole o mesmo que está no `.env.local`.

Atenção para FIREBASE_PRIVATE_KEY: cole o valor sem as aspas externas, mas mantendo os \n literais.

### 4.3 Fazer o deploy
```bash
vercel --prod
```

O Vercel vai gerar uma URL como `https://radical-capacetes.vercel.app`

---

## Estrutura de Arquivos Criados

```
radical/
├── api/
│   ├── sales/
│   │   ├── index.js        ← GET /api/sales, POST /api/sales
│   │   └── [id].js         ← PATCH /api/sales/:id, DELETE /api/sales/:id
│   └── events/
│       ├── index.js        ← GET /api/events, POST /api/events
│       └── [id].js         ← DELETE /api/events/:id
├── lib/
│   └── firebase.js         ← Inicialização do Firebase Admin SDK
├── public/                 ← Frontend (sem alterações!)
├── scripts/
│   └── migrate-to-firestore.js
├── .env.local              ← Credenciais locais (não vai pro Git)
└── vercel.json             ← Configuração do Vercel
```

---

## Regras de Segurança do Firestore

No Firebase Console → Firestore → Regras, configure:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

Como o frontend usa a API `/api/*` (Vercel Functions com Admin SDK),
o Firestore não precisa de acesso público. As regras acima bloqueiam tudo.
