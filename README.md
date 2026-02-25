# 🏛️ SEMAC — Sistema de Gestão da Fiscalização de Posturas

Sistema web para a Secretaria Municipal, migrando o controle de produtividade dos fiscais de planilhas LibreOffice para uma aplicação web moderna com Supabase.

---

## 📂 Estrutura de Arquivos

| Arquivo | Descrição |
|---------|-----------|
| `index.html` | Página de login (CPF com formatação em tempo real + senha) |
| `style.css` | Estilos do login e fundo dinâmico de padrões (raminhos) |
| `script.js` | Lógica de autenticação via Supabase e geração do fundo da tela de login |
| `painel.html` | Dashboard principal (Home, sidebar + abas Produtividade/Históricos) |
| `style_painel.css` | Estilos comuns do painel e sidebar |
| `painel.js` | Lógica de troca de abas, controle de cargo e dados do perfil na sidebar |
| `protecao.js` | Conexão com Supabase centralizada + Redirecionamento de não logados |
| `produtividade.js` | Todo o motor de produtividade: gráficos, envio ao banco, relatórios PDF |
| `style_produtividade.css` | Estilo dos modais, gráficos, badge meta, tabela de relatórios e histórico |
| `supabase_setup.sql` | Scripts SQL de criação de tabelas, Políticas RLS e configuração de Storage (Anexos) |

---

## 🔐 Autenticação e Perfis

- Login utiliza o **CPF** (`000.000.000-00`), traduzido internamente para e-mail e validado de ponta a ponta pelo Supabase.
- Baseado em **Cargos (Roles)** via tabela `profiles`:
  - **Admin**: Acesso a configurações globais (Visão de gestão futura).
  - **Fiscal**: Acesso liberado às abas **Home**, **Produtividade**, **Histórico (Pessoal)** e **Histórico Geral**.

### Aba de Configurações (Meu Perfil)
- Fica disponível para qualquer um na navegação inferior esquerda.
- Exibe o **Cargo**, **Nome**, **CPF**, e agora também a **Matrícula** (Carregados via tabela de perfis `profiles`).
- **Upload de Avatar**: Clique na foto do perfil permite o envio de imagem local `.jpg/.png` dimensionada, que será carregada usando o *Storage (`avatars`)* do supabase com chave única por usuário, atualizando dinamicamente na Sidebar.
- **Redefinição de Senha Segura**: Um modal central de redefinição garante a segurança exigindo que a **Senha Antiga** passe pelo `signInWithPassword()` atrás das cortinas, somado a uma **dupla verificação** da digitação da nova credencial, para só então ativar a trigger de alteração.

---

## 📊 Home / Visão Geral

- Fiscais recebem no início (aba **Home**) um resumo rápido:
  - **Gráfico de Produtividade Diária (Chart.js)**: Gráfico de barras combinando contagem por dia e uma linha para pontos acumulados, com linha indicadora da meta.
  - **Resumo de Pontuação**: Exibe os pontos totais e notificações de conclusão.
  - **Destaque Dinâmico (Meta 2000)**: Quando a soma dos pontos atinge 2000 no mês, um badge dourado pulsante "*🏆 META ATINGIDA*" é exibido.
  - **Botão "Gerar Relatório"**: Processa no navegador um **relatório HTML editável** (com a data de pesquisa, agrupado por categorias e subtotais) com botão para Salvar em formato PDF.

---

## 📝 Sistema de Produtividade

O sistema possui **36 categorias** divididas em Grupos (Cores diferentes):
1. **Controle Processual (1.1° a 1.7°)**: Ficam numa área destacada (cards escuros verdes translucientes).
2. **Atividades Gerais (2° a 30°)**: Ficam nos blocos padrão (cards verdes claros).

### Funcionalidades Especiais:
- **Tabelas Distintas no Supabase**: 
  - *Registros comuns* vão para a tabela `registros_produtividade`.
  - *Controle Processual* vai para a tabela separada `controle_processual`.
- **Anexo Automático em PDF e Editor WYSIWYG**: Categorias específicas como **Auto de Infração** param de perguntar por upload manual ao acionar botão *Gerar Documento* do formulário. Invoca-se um Mini-Editor (Modal editável) que mostra de antemão formato A4 timbrado pronto. O sistema converte simultaneamente para Word e invoca nativamente a biblioteca `html2pdf.js` forçando um download local e em segundo plano a anexação do respectivo PDF assinado/submetido em nuvem, limpando os campos de dados do banco de dados e enviando apenas colunas essenciais.
- **Auto-Preenchimento por Leitura IA de Word**: Algumas categorias (ex. Notificação Preliminar) disponibilizam função "*Preencher c/ Arquivo Word*". Graças ao plugin `mammoth.js`, o sistema varre o DOCX via Regex em busca de blocos cruciais (Contribuinte, CPF, Bairro e Inscrição) repassando instantaneamente para os inputs visuais da plataforma para reduzir o tempo de digitação manual.
- **Campo de Dropdown Persistente Avançado**: A categoria permite dropdowns selecionáveis onde "Outro..." abre criação de motivos customizados, salvos localmente num array próprio, limpáveis pela Lixeira "🗑" e selecionáveis sem interrupção através de manipulação de DOM para impedir perda de focus no input de texto.
- **Numeração Automática**: Algumas atividades de Processual (ex. Ofício e Auto de Infração) puxam sequenciado pelo maior número que o fiscal executou naquele tipo (ex. `0116/2026`).
- **Calculadora de Horas**: Certas rotinas geram pontos multiplicando o "horas gastas" * "fator (ex 30pts/h)".

---

## 📋 Histórico do Usuário e Histórico Geral

- **Histórico Pessoal**: Todo o registro preenchido por um único fiscal é centralizado aqui independente se ele foi parar na tabela Normal ou na tabela de Controle Processual.
    - É possível visualizar os detalhes (inclusive acessar botão p/ visualizar Anexos PDF).
    - O Registro pode ser Editado ou Deletado pelo dono do dado com feedback visual assíncrono (Loading state contra duplo-clique).
    - Ordenação feita de forma inteligente a partir da *Data do Evento informada no Form* e não a do momento da digitação.
- **Histórico Geral**: Aba exclusiva para consulta de todas as entradas da secretaria de **Controle Processual**, subdividido por sub-abas (Notificação, Autofração, AR etc).
    - Visão de leitura com omitimento dinâmico de colunas invisíveis (`ignorarNoBanco`).
    - Buscador que filtra a tabela por texto cruzado em tempo real e dropdown interligado contendo o filtro local de **Bairro** mapeado ao vivo.

---

## 🗄️ Backend Supabase (Tabelas e Storage)

### `registros_produtividade`
Tabela com metadados principais. Guarda o ID das categorias preenchidas e a maioria das pontuações normais.

### `controle_processual`
Tabela designada para categorias "Públicas". Possui a mesma estrutura mas inclui as colunas `fiscal_nome` e `numero_sequencial` para organizar historicamente.

### JSONB (`campos`)
É a coluna vital para evitar 100 tabelas — Os inputs preenchidos das 36 modais viram um Hashmap armazenado de forma compacta. Se houverem PDFs, nela também vai o `publicUrl` guardado do bucket Storage.

### *RLS (Row Level Security)*
A seguridade ocorre camada a camada no BD:
- Fiscais podem inserir e ler os próprios `registros_produtividade`. Ninguém pode ler os da outra pessoa.
- A exclusão e edição também só permite alterar onde `user_id == auth.uid()`.
- O `controle_processual` permite todos os logados visualizarem em *Select*, mas mantém *Updates/Deletes* travados para si mesmo.
- A tabela `profiles` possui um seletor aberto para permitir verificações de nível no login, mas bloqueia atualizações (Avatar ou Configs) estritamente para o proprietário (`id == auth.uid()`).
- No Bucket de Storage `anexos` e `avatars`, usuários têm pastas sob seus `user_ids` nas quais podem criar/atualizar/excluir arquivos livremente. Arquivos baixados têm políticas de SELECT puramente público.

---

## 🚀 Uso Rápido
1. Execute as Views/Tabelas e Buckets no console do **Supabase** via `supabase_setup.sql`.
2. Configure as constantes em `protecao.js`.
3. Adicione o seu cadastro no Control Panel do DB manualmente.
4. O servidor front-end local está pronto utilizando CSS puro sem compilações externas e importando libs (Chart.js / Supabase SDK) no próprio browser.
