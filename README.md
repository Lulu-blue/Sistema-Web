# 🏛️ SEMAC — Sistema de Gestão da Fiscalização de Posturas

Sistema web para a Secretaria Municipal, migrando o controle de produtividade dos fiscais de planilhas LibreOffice para uma aplicação web moderna com Supabase.

---

## 📂 Estrutura de Arquivos

| Arquivo | Descrição |
|---------|-----------|
| `index.html` | Página de login (CPF com formatação em tempo real + senha) |
| `style.css` | Estilos do login e fundo dinâmico de padrões (raminhos) |
| `script.js` | Lógica de autenticação via Supabase e geração do fundo da tela de login |
| `painel.html` | Dashboard principal (Home, sidebar + abas Produtividade/Históricos/Tarefas) |
| `style_painel.css` | Estilos comuns do painel e sidebar |
| `painel.js` | Lógica de troca de abas, controle de cargo, dados do perfil e carregamento do módulo de Tarefas na Home |
| `protecao.js` | Conexão com Supabase centralizada + Redirecionamento de não logados |
| `tarefas.js` | Módulo completo de Tarefas e Calendário: Kanban, eventos, subtarefas, anexos PDF, permissões por role |
| `produtividade.js` | Todo o motor de produtividade: gráficos, envio ao banco, manipulação de modal, formatação e lógicas WYSIWYG de exportação de documento |
| `cabecalho.js` | Script para modularização offline do cabeçalho HTML e menu do dashboard principal |
| `cabecalho_export.js` | Base64 e renderização da injeção de timbre (identidade visual) do WYSIWYG PDF/Word |
| `style_produtividade.css` | Estilo dos modais, gráficos, badge meta, tabela de relatórios e histórico |
| `supabase_setup.sql` | Scripts SQL de criação de tabelas, Políticas RLS e configuração de Storage (Anexos) |
| `setup_tarefas.sql` | Script SQL para as tabelas do módulo de Tarefas: `eventos`, `tarefas`, `tarefa_responsaveis`, `tarefa_anexos`, bucket de storage e índices |

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

### Tabela "Minhas Tarefas" na Home
- Aparece para **todos os usuários** (fiscais e gerentes) logo abaixo dos gráficos.
- Mostra somente tarefas onde o usuário é **responsável direto** + subtarefas dessas tarefas.
- **Ordenação**: atrasadas primeiro (fundo vermelho com badge `ATRASADA`), depois por prazo mais próximo.
- **Colunas**: Tarefa (com nome da tarefa-pai se for subtarefa, prefixo `↳`), Prazo, Status (badge colorido), Progresso (barra visual de subtarefas).
- **Clique** em qualquer linha navega direto para a aba Tarefas.

---

## 📝 Sistema de Produtividade

O sistema possui **36 categorias** divididas em Grupos (Cores diferentes):
1. **Controle Processual (1.1° a 1.7°)**: Ficam numa área destacada (cards escuros verdes translucientes).
2. **Atividades Gerais (2° a 30°)**: Ficam nos blocos padrão (cards verdes claros).

### Funcionalidades Especiais:
- **Tabelas Distintas no Supabase**: 
  - *Registros comuns* vão para a tabela `registros_produtividade`.
  - *Controle Processual* vai para a tabela separada `controle_processual`.
- **Anexo Automático em PDF e Editor WYSIWYG**: Toda categoria oficial "Geradora de Documento" (Auto de Infração, Ofício, Relatório e Réplica) exibe o botão **Gerar Documento** ao invés do upload manual padrão. O preenchimento da modal não vai ao banco de dados imadiatamente; invoca-se um Mini-Editor (Modal editável) que mostra de antemão um formato A4 timbrado preenchido automaticamente com nome, matrícula do fiscal, numeração, dados e datas. O sistema aciona o `html2pdf.js` forçando um download local `.doc/.pdf` e, em segundo plano, acopla silenciosamente esse formulário digital PDF e envia ao Storage em nuvem.
- **Segurança de Documentos no Histórico**: Por tratar-se de peças geradoras de PDF físico baseadas em dados doWYSIWYG, a aba de **Histórico** inibe a edição de Registros dessas naturezas ("Auto de Infracao", "Ofício", "Relatório", "Réplica") protegendo o dado bruto imutável. Caso o usuário cometa um erro de envio, precisará apagar o item por completo e regerar, mantendo a integridade perante o espelho em PDF oficial.
- **Auto-Preenchimento por Leitura IA de Word**: As categorias (ex. Notificação Preliminar e Protocolo) não necessitam preenchimento braçal graças à função inovadora "*Preenchimento Automático (Word)*". Utilizando o plugin local `mammoth.js`, o sistema varre o arquivo original DOCX submetido pelo fiscal instigando uma Extrator de Regex em busca de blocos cruciais no texto emulando NLP (buscando N° de Notificação/Protocolo, Contribuinte, Bairro, Inscrição etc) e repassa os dados instantaneamente para os inputs visuais da UI (e automaticamente preenche o arquivo DOCX original como anexo) em 1 segundo, reduzindo atritos de digitação manual de forma monstruosa.
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

## 📅 Módulo de Tarefas e Calendário (`tarefas.js`)

Módulo completo acessível pela aba **Tarefas** na sidebar (visível para todos os usuários). Layout em duas colunas:
- **Coluna Esquerda**: Calendário mensal + lista de eventos.
- **Coluna Direita**: Kanban de tarefas em 3 colunas.

### Calendário Mensal
- Calendário HTML/CSS puro (sem bibliotecas externas) com navegação mês a mês.
- Dias com eventos destacados com bolinha colorida.
- Dia atual destacado visualmente.

### Eventos
- **Criar evento** (gerente/admin): modal com título, descrição, data e cor (Azul, Verde, Amarelo, Vermelho, Roxo).
- **Listar eventos**: eventos do mês corrente exibidos abaixo do calendário com data, título e cor.
- **Excluir evento**: botão ✕ visível apenas para gerente/admin.
- Todos os usuários podem **visualizar** eventos; apenas gerente/admin podem criar e excluir.

### Kanban de Tarefas
- **3 colunas**: Atrasadas (vermelho), Em Progresso (azul), Concluídas (verde).
- **Visibilidade por role**:
  - **Gerente/Admin**: vê **todas** as tarefas de todos os fiscais.
  - **Fiscal**: vê apenas tarefas onde é responsável.
- **Destaque pessoal**: tarefas onde o usuário logado é responsável têm borda roxa com glow e badge `VOCÊ`.
- **Card da tarefa** exibe:
  - Título (com badge `VOCÊ` se aplicável).
  - Avatares circulares + nomes dos responsáveis (foto do perfil ou ícone SVG placeholder).
  - Prazo com cor dinâmica (vermelho=atrasada, amarelo=próxima, cinza=normal).
  - Barra de progresso de subtarefas com porcentagem.
  - **Lista de subtarefas** com checkboxes interativos (só para tarefas do próprio usuário ou gerente).
- **Criar tarefa** (gerente/admin): modal com título, descrição, prazo, responsáveis (checkboxes com lista de fiscais/gerentes).

### Modal de Detalhe da Tarefa
- **Botões de status**: Pendente / Em Progresso / Concluída — visíveis apenas para responsáveis ou gerentes.
- **Descrição**: exibida em bloco estilizado se existir.
- **Responsáveis**: chips com foto de perfil circular + nome.
- **Prazo**: data formatada em pt-BR.
- **Subtarefas**: lista com checkboxes, nome do responsável designado, botão de anexar PDF e link para anexos já enviados.
- **Anexos**: seção para upload de PDF + listagem com link clicável e botão de excluir.
- **Excluir tarefa**: botão exclusivo para gerente/admin.

### Subtarefas
- **Criar subtarefa** (gerente/admin): mini-modal com título e seletor de responsável (dropdown com lista de fiscais/gerentes).
- Cada subtarefa pode ter:
  - **Responsável designado** (exibido com ícone SVG).
  - **Anexo PDF** (botão de upload direto na subtarefa).
- **Checkbox** para marcar como concluída (apenas se o usuário é responsável da tarefa-pai ou gerente).
- **Barra de progresso**: porcentagem de subtarefas concluídas visível nos cards e no modal.

### Permissões por Role

| Ação | Fiscal | Gerente/Admin |
|------|--------|---------------|
| Ver tarefas no Kanban | Só as suas | Todas |
| Alterar status | Apenas das suas | Todas |
| Criar tarefa/evento | ✗ | ✓ |
| Criar subtarefa | ✗ | ✓ |
| Excluir tarefa/subtarefa/evento | ✗ | ✓ |
| Marcar subtarefa como concluída | Só nas suas tarefas | Todas |
| Anexar PDF em subtarefa | Só nas suas tarefas | Todas |
| Ver eventos | ✓ | ✓ |

### Ícones SVG
- Todos os ícones do módulo utilizam **SVGs inline stroke-only** (estilo minimalista da sidebar), sem emojis.
- Ícones: pessoa, documento, clipe de anexo, lixeira — todos em traço fino de 2px.

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

### `eventos` (Módulo de Tarefas)
Tabela de eventos do calendário. Campos: `titulo`, `descricao`, `data_evento`, `cor` (hex), `criado_por` (FK → auth.users).

### `tarefas` (Módulo de Tarefas)
Tabela de tarefas e subtarefas. Campos: `titulo`, `descricao`, `status` (pendente/em_progresso/concluida), `prazo` (date), `criado_por`, `tarefa_pai_id` (FK → tarefas, para subtarefas). RLS permite leitura para todos autenticados.

### `tarefa_responsaveis` (Módulo de Tarefas)
Relação N:N entre tarefas e usuários. Campos: `tarefa_id` (FK → tarefas), `user_id` (FK → auth.users), `user_name` (texto desnormalizado para display rápido).

### `tarefa_anexos` (Módulo de Tarefas)
Anexos PDF vinculados a tarefas/subtarefas. Campos: `tarefa_id` (FK → tarefas), `nome_arquivo`, `url` (public URL do Storage).

### Storage Bucket `tarefa_anexos`
Bucket para armazenamento dos PDFs anexados às tarefas. Políticas: upload/download para todos autenticados.

---

## 🚀 Uso Rápido
1. Execute as Views/Tabelas e Buckets no console do **Supabase** via `supabase_setup.sql`.
2. Execute o script `setup_tarefas.sql` no console do Supabase para criar as tabelas do módulo de Tarefas (eventos, tarefas, tarefa_responsaveis, tarefa_anexos) e o bucket de storage.
3. Configure as constantes em `protecao.js`.
4. Adicione o seu cadastro no Control Panel do DB manualmente.
5. O servidor front-end local está pronto utilizando CSS puro sem compilações externas e importando libs (Chart.js / Supabase SDK) no próprio browser.
