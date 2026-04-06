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
| `painel.js` | Lógica de troca de abas, controle de cargo, dados do perfil, upload de avatar, redefinição de senha e carregamento do módulo de Tarefas na Home |
| `protecao.js` | Conexão com Supabase centralizada + Redirecionamento de não logados |
| `tarefas.js` | Módulo completo de Tarefas e Calendário: Kanban, eventos, subtarefas, anexos PDF, permissões por role |
| `produtividade.js` | Todo o motor de produtividade: gráficos, envio ao banco, manipulação de modal, formatação e lógicas WYSIWYG de exportação de documento |
| `gerente.js` | **Gestão de Fiscais e Hierarquia Visual**: Ranking de desempenho, gráficos de pontuação, cadastro/exclusão de fiscais, visualização de documentos por tipo, e **árvore hierárquica completa da SEMAC** para Secretários |
| `projetos.js` | **Calendário de Eventos**: Lógica vanilla JS para calendário mensal, navegação entre meses, filtros por data e visualização de eventos |
| `fechamento.js` | **Fechamento Anual**: Consolidação de registros em ZIP, geração de planilhas Excel formatadas, envio via Google Apps Script |
| `style_produtividade.css` | Estilo dos modais, gráficos, badge meta, tabela de relatórios e histórico |
| `PERMISSOES_SETUP.md` | Guia completo e definitivo de configuração de permissões hierárquicas, regras de RLS (Row Level Security) e criação de cargos e funções no Supabase, consolidando os antigos arquivos `.sql` soltos e `.csv`. |
| `lib/` | **Pasta de Bibliotecas Locais**: Contém Supabase, Chart.js, SweetAlert2, html2pdf.js, JSZip, SheetJS (XLSX), Mammoth.js e outras dependências para garantir funcionamento offline ou em redes com restrição de DNS. |

---

## 🔐 Autenticação e Perfis

- Login utiliza o **CPF** (`000.000.000-00`), traduzido internamente para e-mail e validado de ponta a ponta pelo Supabase.
- Baseado em **Cargos (Roles)** via tabela `profiles`:
  - **Admin**: Acesso a configurações globais (Visão de gestão futura).
  - **Fiscal**: Acesso liberado às abas **Home**, **Produtividade**, **Histórico (Pessoal)** e **Histórico Geral**.
  - **Diretor de Meio Ambiente**: Perfil de supervisão com interface dinâmica. Possui menu lateral expansível ("Gerência de Posturas") e visão de gestão de produtividade da equipe.

### Perfis de Usuário (Roles)

O sistema possui **8+ cargos distintos** com permissões específicas:

| Cargo | Permissões Principais |
|-------|----------------------|
| **Admin** | Acesso total, incluindo gerenciamento de usuários |
| **Fiscal** | Produtividade, Histórico Pessoal, Histórico Geral, Tarefas |
| **Fiscal de Posturas** | Mesmas permissões do Fiscal (variação de cargo) |
| **Gerente Fiscal** | Histórico Geral, Bairros, visão de gestão de fiscais |
| **Gerente de Posturas** | Projetos, Bairros, Tarefas, Calendário de Eventos |
| **Gerente de Regularização Ambiental** | Gestão de equipe ambiental (Eng. Agrônomos, Eng. Civis, Analistas, Auxiliares), Tarefas, Calendário |
| **Administrativo de Posturas** | Acesso ao Histórico Geral (visor apenas) |
| **Diretor de Meio Ambiente** | Acesso total com menus expansíveis "Gerência de Posturas" e "Gerência de Regularização Ambiental", alternância entre modos Direção e Gerência |
| **Secretário(a)** | Acesso total com menu expansível "Direção de Meio Ambiente", gestão de Diretores, criação de tarefas para qualquer usuário |
| **Gerente de Interface Jurídica** | Tarefas próprias (criar/ver apenas onde é responsável), visualização de projetos, **sem** gestão de equipe |
| **Agente de Administração** | Tarefas próprias (criar/ver apenas onde é responsável), visualização de projetos, **sem** gestão de equipe |

### Aba de Configurações (Meu Perfil)
- Fica disponível para qualquer um na navegação inferior esquerda.
- Exibe o **Cargo**, **Nome**, **CPF**, **Matrícula** e **E-mail Real** (Carregados via tabela de perfis `profiles`).
- **Upload de Avatar**: Clique na foto do perfil permite o envio de imagem local `.jpg/.png` dimensionada, que será carregada usando o *Storage (`avatars`)* do supabase com chave única por usuário, atualizando dinamicamente na Sidebar.
- **Redefinição de Senha Interna**: Um modal central de redefinição de senha para usuários logados, que exige a **Senha Antiga** (validada via `signInWithPassword()`) e **dupla verificação** da nova senha.
- **Recuperação de Senha (Esqueci minha senha)**:
  - Fluxo customizado via RPC no Supabase validando **Nome + CPF**.
  - Envio de token de segurança válido por 1 hora para o e-mail real do usuário.
  - O e-mail é disparado via **Google Apps Script** (contornando a necessidade de SMTP direto no Supabase e possíveis bloqueios).
  - Atualização da senha (criptografada) via `redefinir-senha.html`.
---

## 📊 Home / Visão Geral

- Fiscais recebem no início (aba **Home**) um resumo rápido:
  - **Gráfico de Produtividade Diária (Chart.js)**: Gráfico de barras combinando contagem por dia e uma linha para pontos acumulados, com linha indicadora da meta.
  - **Resumo de Pontuação**: Exibe os pontos totais e notificações de conclusão.
  - **Destaque Dinâmico (Meta 2000)**: Quando a soma dos pontos atinge 2000 no mês, um badge dourado pulsante "*🏆 META ATINGIDA*" é exibido.
  - **Botão "Gerar Relatório"**: Processa no navegador um **relatório HTML editável** (com a data de pesquisa, agrupado por categorias e subtotais) com botão para Salvar em formato PDF. O título do relatório insere automaticamente o "Mês/Ano" corrente baseado no dia de fechamento (até dia 3 = mês anterior, pós-dia 3 = mês atual).
- **Botão "Limpeza Geral"**: Localizado ao lado do relatório, permite que o fiscal limpe permanentemente seus dados da tabela `registros_produtividade` e **zere a pontuação** da tabela `controle_processual` vinculada a ele.
    - **⚠️ Integridade**: O botão **NÃO apaga** os registros da tabela `controle_processual` (Notificações, Autos, Ofícios, etc), garantindo que os documentos oficiais continuem existindo no Histórico Geral, apenas remove a pontuação associada ao fiscal no histórico pessoal.
- **Alerta de Encerramento Mensal**: Um banner verde translúcido aparece automaticamente no topo da Home no **último dia de cada mês**, lembrando o fiscal de gerar seu relatório antes da virada do calendário.
- **Visão de Diretoria (Home)**: Quando o **Diretor de Meio Ambiente** expande o menu de gestão, a Home alterna automaticamente para exibir os gráficos de desempenho dos fiscais e outras ferramentas de supervisão.

---

## 📊 Relatório Individual do Fiscal (Gestão)
- **Acesso**: Clique no nome do fiscal no ranking de desempenho (Home do Gerente/Diretor).
- **Dados exibidos**: Todos os registros de produtividade e controle processual do fiscal selecionado.
- **Filtragem por período**: Visualização dos últimos 30 dias por padrão.
- **Pontuação detalhada**: Soma de pontos por categoria e total acumulado.

---

## 📅 Fechamento Anual (`fechamento.js`)
- **Mecanismo de Consolidação**: Reúne todos os registros de produtividade e controle processual do ano vigente.
- **Geração de Anexos (ZIP)**: Cria automaticamente um arquivo ZIP organizado por pastas:
  - Estrutura: `Ano/Documentos/Categoria/NumeroSequencial.pdf`
  - Exemplo: `2025/Documentos/Notificação Preliminar/0116/2025.pdf`
- **Geração de Planilha Excel**: Planilha formatada com:
  - Uma aba para cada categoria de documento
  - Cabeçalhos estilizados (negrito, fundo cinza)
  - Linhas congeladas para facilitar navegação
  - Colunas de: N°, campos específicos, Fiscal, Data, Pontos, Datas de Entrada/Vencimento (para NP/AI), Histórico Admin, Resposta do Fiscal
- **Envio via Google Apps Script**: Disparo direto para o e-mail cadastrado, contornando bloqueios de rede.
- **Limpeza Agendada**: Após confirmação de recebimento, limpeza automática dos dados do ano fechado.

### Tabela "Minhas Tarefas" na Home
- Aparece para **todos os usuários** (fiscais e gerentes) logo abaixo dos gráficos.
- Mostra somente tarefas onde o usuário é **responsável direto** + subtarefas dessas tarefas.
- **Ordenação**: atrasadas primeiro (fundo vermelho com badge `ATRASADA`), depois por prazo mais próximo.
- **Colunas**: Tarefa (com nome da tarefa-pai se for subtarefa, prefixo `↳`), Prazo, Status (badge colorido), Progresso (barra visual de subtarefas).
- **Clique** em qualquer linha navega direto para a aba Tarefas.

### Alertas de NP / AI na Home (Fiscal)
- Seção exclusiva para fiscais mostrando **Notificações Preliminares** e **Autos de Infração**.
- Duas abas: **Vencidos** (alertas vermelhos) e **Atendidos** (confirmados).
- Contadores em badges coloridos indicando quantidade de itens em cada status.
- Permite acompanhamento rápido de prazos processuais diretamente na Home.

---

## 📅 Módulo de Projetos e Calendário (`projetos.js`)

Sistema de calendário mensal vanilla JS para gerenciamento de eventos e projetos.

### Calendário Mensal
- **Navegação intuitiva**: Botões para mudar entre meses (← →).
- **Visualização de eventos**: Barras coloridas indicam eventos nos dias.
- **Dia atual destacado**: Círculo azul no dia corrente.
- **Filtro por data**: Clique em um dia para filtrar eventos específicos.
- **Eventos multi-dia**: Suporte a eventos com data de início e fim.

### Gestão de Eventos
- **Criar evento** (Diretor/Gerente): Modal com título, descrição, data início/fim, cor (Azul, Verde, Amarelo, Vermelho, Roxo).
- **Listar eventos**: Cards com título, datas, descrição e cor identificadora.
- **Expandir detalhes**: Clique no card para ver descrição completa e tarefas vinculadas.
- **Excluir evento**: Botão de exclusão visível apenas para quem tem permissão.

### Visibilidade por Perfil
| Perfil | Visualizar | Criar/Editar | Excluir |
|--------|------------|--------------|---------|
| Diretor | Todos os eventos | ✓ | ✓ |
| Fiscal | Todos os eventos | ✗ | ✗ |
| Gerente | Eventos onde é responsável ou tem tarefa vinculada | ✗ | ✗ |
| Cargos Especiais* | Apenas onde é responsável | ✗ | ✗ |

\* **Cargos Especiais**: Gerente de Interface Jurídica, Agente de Administração

---

## 🗺️ Módulo de Bairros e Áreas (`gerente.js`)

Gestão completa de áreas de atuação e mapeamento de bairros para fiscais.

### Áreas de Atuação
- **Cadastro de áreas**: Nome da área e fiscal responsável.
- **Lista de áreas**: Visualização com fiscal vinculado e quantidade de bairros.
- **Edição/Exclusão**: Modificar dados ou remover áreas existentes.

### Mapeamento de Bairros
- **Cadastro de bairros**: Nome do bairro, área vinculada, fiscal responsável.
- **Busca rápida**: Filtro de bairros por nome.
- **Contador**: Total de bairros cadastrados.

### Sistema de Rotação
- **Rotação de Áreas**: Troca automática de fiscais entre áreas de atuação.
- **Rotação de Bairros**: Realocação de responsáveis por bairros específicos.
- **Painel visual**: Interface dedicada para gerenciar rotações.

### Gráficos Estatísticos
- **Top 10 Bairros - NP**: Gráfico de barras horizontais com os bairros com mais Notificações Preliminares.
- **Top 10 Bairros - AI**: Gráfico de barras horizontais com os bairros com mais Autos de Infração.

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

- **Histórico Pessoal**: Centraliza os registros do fiscal (Normal e Controle Processual), porém exibe **exclusivamente itens com pontuação maior que zero**. Isso permite que, após a "Limpeza Geral", o histórico pessoal fique limpo sem perder os dados oficiais do sistema.
    - É possível visualizar os detalhes (inclusive acessar botão p/ visualizar Anexos PDF).
    - O Registro pode ser Editado ou Deletado pelo dono do dado com feedback visual assíncrono (Loading state contra duplo-clique).
    - Ordenação feita de forma inteligente a partir da *Data do Evento informada no Form* e não a do momento da digitação.
- **Histórico Geral**: Aba exclusiva para consulta de todas as entradas da secretaria de **Controle Processual**, subdividido por sub-abas (Notificação, Autofração, AR etc).
    - Visão de leitura com omitimento dinâmico de colunas invisíveis (`ignorarNoBanco`).
    - Buscador que filtra a tabela por texto cruzado em tempo real e dropdown interligado contendo o filtro local de **Bairro** mapeado ao vivo.

---

## ✅ Módulo de Tarefas(`tarefas.js`)

Módulo completo acessível pela aba **Tarefas** na sidebar (visível para todos os usuários). Layout em duas colunas:
- **Coluna Esquerda**: Calendário mensal + lista de eventos.
- **Coluna Direita**: Kanban de tarefas em 3 colunas.

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
- **Criar tarefa** (gerente): modal com título, descrição, prazo, responsáveis (checkboxes com lista de fiscais/gerentes).

### Modal de Detalhe da Tarefa
- **Botões de status**: Pendente / Em Progresso / Concluída — visíveis apenas para responsáveis ou gerentes.
- **Descrição**: exibida em bloco estilizado se existir.
- **Responsáveis**: chips com foto de perfil circular + nome.
- **Prazo**: data formatada em pt-BR.
- **Subtarefas**: lista com checkboxes, nome do responsável designado, botão de anexar PDF e link para anexos já enviados.
- **Anexos**: seção para upload de PDF + listagem com link clicável e botão de excluir.
- **Excluir tarefa**: botão exclusivo para gerente.

### Subtarefas
- **Criar subtarefa** (gerente): mini-modal com título e seletor de responsável (dropdown com lista de fiscais/gerentes).
- Cada subtarefa pode ter:
  - **Responsável designado** (exibido com ícone SVG).
  - **Anexo PDF** (botão de upload direto na subtarefa).
- **Checkbox** para marcar como concluída (apenas se o usuário é responsável da tarefa-pai ou gerente).
- **Barra de progresso**: porcentagem de subtarefas concluídas visível nos cards e no modal.

### Permissões por Role

| Ação | Fiscal | Gerente/Admin | Diretor de Meio Ambiente | Secretário(a) | Gerente RA | Cargos Especiais* |
|------|--------|---------------|--------------------------|---------------|------------|-------------------|
| Ver tarefas no Kanban | Só as suas | Todas | Todas | Todas | Só da equipe RA | Só onde é responsável |
| Alterar status | Apenas das suas | Todas | Todas | Todas | Todas | Apenas das suas |
| Criar tarefa | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ (apenas para si) |
| Criar evento/projeto | ✗ | ✗ | ✓ | ✓ | ✗ | ✗ |
| Criar subtarefa | ✗ | ✓ | ✓ | ✓ | ✓ | ✗ |
| Excluir tarefa/subtarefa/evento | ✗ | ✓ | ✓ | ✓ | ✓ | ✗ |
| Marcar subtarefa como concluída | Só nas suas tarefas | Todas | Todas | Todas | Todas | ✗ |
| Anexar PDF em subtarefa | Só nas suas tarefas | Todas | Todas | Todas | Todas | ✗ |
| Ver eventos/projetos | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (onde é responsável) |
| Gerenciar Gerentes | ✗ | ✗ | ✓ | ✓ | ✗ | ✗ |
| Gerenciar Diretores | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ |
| Gerenciar Equipe Ambiental | ✗ | ✗ | ✓ | ✓ | ✓ | ✗ |
| Cadastrar Funcionários | ✗ | ✗ | ✓ | ✓ | ✗ | ✗ |
| Desativar Funcionários | ✗ | ✗ | ✓ | ✓ | ✗ | ✗ |

\* **Cargos Especiais**: Gerente de Interface Jurídica, Agente de Administração

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
Tabela de eventos do calendário. Campos: `titulo`, `descricao`, `data_inicio`, `data_fim`, `cor` (hex), `criado_por` (FK → auth.users), `responsavel_id`.

### `tarefas` (Módulo de Tarefas)
Tabela de tarefas e subtarefas. Campos: `titulo`, `descricao`, `status` (pendente/em_progresso/concluida), `prazo` (date), `criado_por`, `tarefa_pai_id` (FK → tarefas, para subtarefas), `evento_id` (FK → eventos). RLS permite leitura para todos autenticados.

### `tarefa_responsaveis` (Módulo de Tarefas)
Relação N:N entre tarefas e usuários. Campos: `tarefa_id` (FK → tarefas), `user_id` (FK → auth.users), `user_name` (texto desnormalizado para display rápido).

### `tarefa_anexos` (Módulo de Tarefas)
Anexos PDF vinculados a tarefas/subtarefas. Campos: `tarefa_id` (FK → tarefas), `nome_arquivo`, `url` (public URL do Storage).

### `areas_atuacao` (Módulo de Bairros)
Tabela de áreas de atuação dos fiscais. Campos: `nome`, `fiscal_id` (FK → auth.users), `created_at`.

### `bairros` (Módulo de Bairros)
Tabela de bairros mapeados. Campos: `nome`, `area_id` (FK → areas_atuacao), `fiscal_id` (FK → auth.users), `created_at`.

### Variáveis de Controle de Modo (Frontend)
| Variável | Valores | Descrição |
|----------|---------|-----------|
| `diretorModoVisualizacao` | `'direcao'`, `'gerencia_posturas'`, `'gerencia_ambiental'` | Modo atual do Diretor |
| `secretarioModoVisualizacao` | `'normal'`, `'direcao'`, `'gerencia_ambiental'` | Modo atual do Secretário |
| `secretarioModoGerencia` | `true`, `false` | Sub-modo Gerência de Posturas do Secretário |
| `idsGerentesGlobal` | Array de UUIDs | IDs dos Gerentes de Posturas |
| `idsGerentesAmbientalGlobal` | Array de UUIDs | IDs dos Gerentes de Regularização Ambiental |

---

## 🏛️ Módulo do Secretário(a)

O Secretário(a) possui visão hierárquica completa do sistema, com dashboard reorganizado em layout de duas colunas.

### Dashboard do Secretário (Home):

O dashboard foi reorganizado em **layout de duas colunas** para melhor aproveitamento do espaço:

```
┌─────────────────────────────────┬─────────────────────────────┐
│  🌳 ÁRVORE HIERÁRQUICA          │  📋 VISÃO GERAL DE TAREFAS  │
│  (60% da largura)               │                             │
│                                 │  • Pendentes                │
│  • Diretores                    │  • Em Progresso             │
│  • Gerentes de Posturas         │  • Atrasadas                │
│  • Fiscais                      │  • Próximas 5 tarefas       │
│  • Gerentes de Regularização RA │                             │
│  • Equipe Ambiental             │  📊 CONTROLE PROCESSUAL     │
│                                 │  (30 dias)                  │
│  [+ Novo] em cada nível         │  • Gráfico doughnut         │
│  Contadores discretos           │  • Por tipo de documento    │
│  (X diretores, X gerentes...)   │  • Total de registros       │
│                                 │                             │
│                                 │  📅 PROJETOS                │
│                                 │  • Calendário mensal        │
│                                 │  • Dias com eventos         │
│                                 │  • Próximos 3 eventos       │
│                                 │  • [Ver todos →]            │
└─────────────────────────────────┴─────────────────────────────┘
```

#### Coluna Esquerda - Árvore Hierárquica:
- **Visualização organizacional** completa da SEMAC em formato de árvore
- **Cards transparentes** com bordas coloridas por cargo:
  - Roxo (`#7c3aed`) para Diretores de Meio Ambiente
  - Verde escuro (`#0c3e2b`) para Gerentes de Posturas
  - Azul (`#1e3a5f`) para Gerentes de Regularização Ambiental
  - Laranja (`#b45309`) para Fiscais
  - Verde (`#065f46`) para Equipe Ambiental
  - Rosa (`#db2777`) para Diretor(a) do Cuidado Animal
  - Rosa escuro (`#be185d`) para Gerente do Cuidado Animal
  - Magenta (`#c026d3`) para Coordenador(a) do Cuidado Animal
- **Botões "+ Novo"** em cada nível para cadastro rápido
- **Ícone de lixeira** em cada card para desativação de funcionários
- **Contadores discretos** embaixo de cada cargo (ex: "3 diretores", "5 fiscais")
- **Clique nos cards** abre estatísticas (tarefas + produtividade para Fiscais)

#### Estrutura da Árvore Hierárquica (Visualização Secretário):

```
                    SEMAC
                      │
    ┌─────────────────┼─────────────────┐
    │                 │                 │
Diretor MA      Diretor CA      [Cargos Especiais]
    │                 │              (embaixo)
┌───┴───┐             │
│       │             │
Post.  Amb.      Gerente CA
│       │             │
Fisc.  Equipe    Coordenadores
```

**Características da visualização:**
- **Diretor de Meio Ambiente**: Expandido horizontalmente com duas colunas internas (Posturas e Ambiental)
- **Gerência de Posturas**: Coluna com Gerentes → Fiscais (grid 2 colunas)
- **Gerência Ambiental**: Coluna com Gerentes → Equipe RA (grid 2 colunas)
- **Diretor do Cuidado Animal**: Coluna única com Gerente → Coordenadores
- **Cargos Especiais (RH/ADM e Jurídico)**: Seção separada embaixo de toda a hierarquia
- **Cores por hierarquia**:
  - Secretário: `#1e3a5f` (azul escuro)
  - Diretor MA: `#7c3aed` (roxo)
  - Gerência Posturas: `#0c3e2b` (verde escuro)
  - Fiscais: `#b45309` (laranja)
  - Gerência Ambiental: `#1e3a5f` (azul)
  - Equipe RA: `#065f46` (verde)
  - Diretor CA: `#db2777` (rosa)
  - Gerente CA: `#be185d` (rosa escuro)
  - Coordenadores: `#c026d3` (magenta)
  - RH/ADM: `#0d9488` (verde água)
  - Jurídico: `#4f46e5` (indigo)

#### Coluna Direita - Dashboards:
1. **Visão Geral de Tarefas**:
   - Cards com contadores de Pendentes, Em Progresso e Atrasadas
   - Lista das 5 tarefas mais próximas do prazo
   - Layout compacto e informativo

2. **Controle Processual (30 dias)**:
   - Gráfico doughnut com distribuição de documentos por tipo
   - Tipos: Notificação, Auto de Infração, AR, Ofício, Relatório, Protocolo, Réplica
   - Total de registros no período

3. **Projetos (Calendário)**:
   - Calendário mensal compacto com dias destacados
   - Dias com eventos coloridos conforme a cor do projeto
   - Dia atual em destaque azul
   - Lista dos 3 próximos eventos com título e data
   - Clique em qualquer evento ou "Ver todos →" navega para a aba Projetos

### Hierarquia de Cargos:
```text
Secretário(a) (nível 4)
 ├── Diretor(a) de Meio Ambiente (nível 3)
 │    ├── Gerente de Posturas (nível 2) → Fiscal (nível 1)
 │    └── Gerente de Regularização Ambiental (nível 2) → Equipe Ambiental (nível 1)
 │
 ├── Diretor(a) do Cuidado Animal (nível 3)
 │    └── Gerente do Cuidado Animal (nível 2)
 │         └── Coordenador(a) do Cuidado Animal (nível 1)
 │
 ├── Gerente de Interface Jurídica (Cargo Especial)
 └── Agente de Administração (Cargo Especial)
```

> **Nota**: Cargos Especiais (Gerente de Interface Jurídica, Agente de Administração) **não fazem parte da hierarquia de gestão**. Eles têm acesso apenas às próprias tarefas e não gerenciam equipes.

### Funcionalidades de Gestão:
- **Gestão Completa de Funcionários**: Cadastro e desativação de todos os cargos
  - Hierarquia de permissões: Secretário pode gerenciar Diretores, Gerentes, Fiscais e Equipe RA
  - Diretor pode gerenciar Gerentes, Fiscais e Equipe RA
  - Gerente pode gerenciar Fiscais/Equipe sob sua responsabilidade
- **Criação de Tarefas**: Pode criar tarefas para qualquer usuário do sistema
- **Direção de Meio Ambiente**: Menu expansível com:
  - Sub-menu "Gerência de Posturas" (completo)
  - Sub-menu "Gerência de Regularização Ambiental" (completo)
- **Filtros de Tarefas**: 
  - Modo Direção: vê tarefas de Diretores
  - Modo Gerência Posturas: vê tarefas de Gerentes de Posturas
  - Modo Gerência Ambiental: vê tarefas da equipe de Regularização Ambiental

### Menu Sidebar do Secretário:
```
📋 Tarefas
📁 Direção de Meio Ambiente (toggle)
   📁 Projetos
   📁 Tarefas (Direção)
   📁 Gerência de Posturas (sub-toggle)
      📁 Bairros
      📁 Histórico Geral
      📁 Tarefas (Gerência)
   📁 Gerência de Regularização Ambiental (toggle)
      📁 Dashboard da Equipe
      📁 Tarefas (RA)
```

### Comportamento do Sub-menu:
- **Clicar em "Direção de Meio Ambiente" (menu fechado)**: Abre o menu, muda para modo Direção
- **Clicar em "Direção de Meio Ambiente" (menu aberto + sub-submenu aberto)**: Fecha apenas o sub-submenu, mantém o menu aberto, volta para modo Direção
- **Clicar em "Direção de Meio Ambiente" (menu aberto + sem sub-submenu)**: Fecha o menu completamente, volta para modo normal
- **Clicar em "Gerência de Posturas"**: Abre/fecha sub-submenu, alterna modo Gerente (Posturas)
- **Clicar em "Gerência de Regularização Ambiental"**: Abre/fecha sub-submenu, alterna modo Gerência RA
- **Clicar fora do menu**: Fecha todo o menu, volta para modo normal

> **Nota:** O botão "Direção de Meio Ambiente" requer **dois cliques** para fechar completamente quando um sub-submenu está aberto. O primeiro clique fecha o sub-submenu e volta para a visão do Diretor, o segundo clique fecha o menu principal.

### Filtros de Visibilidade de Tarefas por Modo:

#### Diretor de Meio Ambiente
| Modo | Tarefas Visíveis |
|------|------------------|
| `direcao` | Apenas tarefas criadas pelo próprio Diretor |
| `gerencia_posturas` | Tarefas criadas por Gerentes de Posturas |
| `gerencia_ambiental` | Tarefas criadas por Gerentes RA **OU** onde equipe RA é responsável |

#### Secretário(a)
| Modo | Tarefas Visíveis |
|------|------------------|
| `normal` | Todas as tarefas (sem filtro) |
| `direcao` | Tarefas de Diretores |
| `gerencia_posturas` | Tarefas criadas por Gerentes de Posturas (sub-modo) |
| `gerencia_ambiental` | Tarefas criadas por Gerentes RA **OU** onde equipe RA é responsável |

#### Gerente de Regularização Ambiental
- Vê tarefas que **criou** OU onde é **responsável**
- Pode criar tarefas para qualquer membro da equipe ambiental
- **Não pode** criar projetos/eventos (apenas Diretor/Secretário)

### Storage Buckets
- **`anexos`**: PDFs de documentos do controle processual
- **`avatars`**: Fotos de perfil dos usuários
- **`tarefa_anexos`**: Anexos de tarefas e subtarefas

Políticas: Upload/download para usuários autenticados, arquivos organizados em pastas por `user_id`.

---

## 🌿 Módulo do Gerente de Regularização Ambiental (GRA)

O Gerente de Regularização Ambiental possui visão específica para gestão da equipe técnica ambiental.

### Equipe Gerenciada:
| Cargo | Descrição |
|-------|-----------|
| **Engenheiro(a) Agrônomo(a)** | Especialista em regularização ambiental rural |
| **Engenheiro(a) Civil** | Especialista em regularização urbanística |
| **Analista Ambiental** | Análise de processos ambientais |
| **Auxiliar de Serviços II** | Suporte operacional à equipe |

### Funcionalidades:
- **Dashboard de Equipe**: Contadores por cargo (4 cards coloridos)
- **Lista de Membros**: Visualização com foto, nome, cargo e estatísticas de tarefas
- **Clique no Membro**: Abre modal com detalhamento de tarefas (total, concluídas, pendentes, atrasadas)
- **Novo Funcionário**: Botão para cadastrar novos membros à equipe
- **Desativar Funcionário**: Opção para marcar funcionário como inativo (role = 'inativo')

### Visibilidade de Tarefas:
- **Modo Gerência RA**: Diretor visualiza tarefas onde a equipe RA é responsável (não apenas criadas por eles)
- **Tarefas da Equipe**: Cards clicáveis mostram estatísticas detalhadas de produtividade

---

## ⚖️ Cargos Especiais (Interface Jurídica e Administração)

Cargos com permissões específicas e restritas, **não tratados como Gerentes** no sistema.

### Cargos Disponíveis:
| Cargo | Descrição |
|-------|-----------|
| **Gerente de Interface Jurídica** | Responsável por demandas jurídicas e interface com o setor legal |
| **Agente de Administração** | Responsável por tarefas administrativas internas |

### Características dos Cargos Especiais:

#### 🏠 Home Exclusiva
- **Layout em duas colunas**:
  - **Esquerda**: Minhas Tarefas (apenas onde é responsável)
  - **Direita**: Calendário de Projetos/Eventos (próximos 30 dias)
- **Sem acesso** às dashboards de gestão de fiscais ou equipes

#### 📋 Permissões de Tarefas:
| Ação | Permissão |
|------|-----------|
| Ver tarefas | Apenas onde é **responsável** ou **criador** |
| Criar tarefa | ✓ (apenas para si mesmo) |
| Atribuir responsável | Apenas **próprio usuário** (não pode atribuir a terceiros) |
| Alterar status | Apenas das próprias tarefas |
| Criar subtarefa | ✗ |
| Excluir tarefa | ✗ |

#### 📅 Permissões de Projetos/Eventos:
| Ação | Permissão |
|------|-----------|
| Ver projetos/eventos | ✓ (onde é responsável) |
| Criar projeto/evento | ✗ (apenas Diretor/Secretário) |
| Editar projeto/evento | ✗ |
| Excluir projeto/evento | ✗ |

#### 🔧 Menu Sidebar:
```
🏠 Home
📁 Projetos (visualização apenas)
📋 Tarefas
```

#### ⚠️ Restrições Importantes:
- **Não aparecem** no ranking de gerentes
- **Não têm acesso** ao Histórico Geral de fiscais
- **Não podem** gerenciar equipes ou fiscais
- **Não podem** criar eventos/projetos (apenas visualizar)

#### 🔧 Implementação Técnica:
- **Detecção automática**: O sistema normaliza o texto do cargo para remover acentos antes da verificação:
  ```javascript
  var roleLowerNorm = roleLower.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  // "jurídica" → "juridica", "administração" → "administracao"
  ```
- **Detecção por prioridade**: Cargos especiais são verificados **antes** da detecção genérica de "gerente", evitando que sejam tratados como Gerentes de Posturas
- **User ID**: A função `carregarCalendarioProjetosEspecial()` obtém o ID do usuário via `getAuthUser()` caso `userIdGlobal` não esteja disponível

---

## 🔐 Permissões Hierárquicas (SQL)

### Script: `setup_permissoes_diretor_gerenciar.sql`
Configura políticas RLS para permitir que **Diretor** e **Secretário** gerenciem funcionários.

### Funções Criadas:
| Função | Descrição |
|--------|-----------|
| `is_diretor_ou_secretario(user_id)` | Verifica se usuário tem permissão de gestão |
| `criar_novo_usuario(email, senha, nome, role, cpf)` | Cria usuário completo (auth.users + profiles) |
| `desativar_usuario(user_id)` | Marca usuário como inativo |

### Políticas RLS:
- **INSERT**: Diretor/Secretário podem cadastrar novos funcionários
- **UPDATE**: Diretor/Secretário podem atualizar qualquer perfil
- **SELECT**: Todos autenticados podem visualizar perfis

### Script: `setup_permissoes_secretario.sql`
Configura permissões especiais para **Secretário** e **Desenvolvedores** gerenciarem qualquer usuário no sistema.

#### Funções Criadas:
| Função | Descrição | Quem pode usar |
|--------|-----------|----------------|
| `is_secretario_ou_dev(user_id)` | Verifica se é Secretário ou Dev | Interno |
| `criar_novo_usuario(email, senha, nome, cargo, cpf, matricula)` | Cria usuário completo | Secretário/Dev |
| `desativar_usuario(user_id)` | Soft delete (marca como inativo) | Secretário/Dev |
| `excluir_usuario_permanente(user_id)` | Hard delete (apenas Devs) | Desenvolvedor |

#### Critérios de Identificação:
- **Secretário**: Campo `role` contém "Secretário", "Secretario", "Secretária" ou "Secretaria"
- **Desenvolvedor**: Email contém "dev@", "admin@", "desenvolvedor" ou role contém "admin"

### Hierarquia de Exclusão:
```
Secretário(a) pode desativar: Todos (incluindo Diretores)
Diretor pode desativar: Gerentes, Fiscais, Equipe RA (exceto Secretários)
Gerente pode desativar: Após as políticas SQL, somente via código da aplicação
```

---

## 🎨 Estilos e UI

### Sidebar Rolável (`style_painel.css`)
- **Comportamento**: A sidebar se torna rolável automaticamente quando o conteúdo excede a altura da tela
- **Scrollbar customizada**: Barra de rolagem discreta com cor semitransparente (`rgba(255, 255, 255, 0.2)`)
- **Transparência**: A scrollbar só aparece quando necessário (overflow-y: auto)
- **Cor no hover**: Efeito de destaque ao passar o mouse sobre a scrollbar

### Hierarquia Visual dos Cards
| Container | Cor do Card | Descrição |
|-----------|-------------|-----------|
| Home do Diretor | `#0c3e2b → #062117` | Total de Gerentes (verde escuro) |
| Home do Secretário | `#0c3e2b → #062117` | Total de Diretores (verde escuro) |
| Home do Gerente | `#1e293b → #0f172a` | Total de Fiscais (cinza escuro) |
| Home Gerência Ambiental | `#065f46 → #047857` | Contadores da Equipe RA (verde ambiental) |

---

## 📚 Bibliotecas Locais (`lib/`)

Todas as dependências são mantidas localmente para garantir funcionamento **offline** ou em redes corporativas com restrições de DNS.

| Biblioteca | Versão | Função |
|------------|--------|--------|
| `supabase.js` | v2.x | Cliente Supabase para autenticação e banco de dados |
| `chart.js` | v4.x | Geração de gráficos (barras, doughnut, linhas) |
| `sweetalert2.all.min.js` | v11.x | Modais e alertas estilizados |
| `html2pdf.bundle.min.js` | v0.10.x | Exportação de HTML para PDF |
| `jszip.min.js` | v3.x | Compressão de arquivos em ZIP |
| `FileSaver.min.js` | v2.x | Download de arquivos no navegador |
| `xlsx.bundle.js` | v0.18.x | Geração e manipulação de planilhas Excel |
| `mammoth.browser.min.js` | v1.x | Leitura de arquivos Word (.docx) para extração de texto |

---

## 🔧 Funções JavaScript Principais

### painel.js
| Função | Descrição |
|--------|-----------|
| `toggleDirecaoMeioAmbiente()` | Toggle do menu "Direção de Meio Ambiente" do Secretário |
| `toggleGerenciaPosturasSecretario()` | Toggle do sub-menu "Gerência de Posturas" do Secretário |
| `toggleGerenciaAmbientalSecretario()` | Toggle do sub-menu "Gerência de Regularização Ambiental" do Secretário |
| `fecharDirecaoSecretario()` | Fecha o menu e sub-menus do Secretário |
| `fecharGerenciaAmbientalSecretario()` | Fecha o sub-menu de Gerência Ambiental do Secretário |
| `toggleGerenciaPosturas()` | Toggle do menu "Gerência de Posturas" do Diretor |
| `toggleGerenciaAmbiental()` | Toggle do menu "Gerência de Regularização Ambiental" do Diretor |
| `fecharGerenciaAmbientalDiretor()` | Fecha o menu de Gerência Ambiental do Diretor |
| `fecharGerenciaDiretor()` | Fecha o menu do Diretor |
| `carregarDashboardGerenteAmbiental()` | Carrega dashboard da equipe de Regularização Ambiental |
| `mostrarTarefasFuncionario(userId, userName)` | Exibe modal com estatísticas de tarefas do funcionário |
| `desativarFuncionarioAmbiental(userId)` | Desativa funcionário da equipe ambiental |
| `abrirFormNovoFuncionarioAmbiental()` | Abre modal para cadastrar novo funcionário ambiental |

### gerente.js
| Função | Descrição |
|--------|-----------|
| `carregarDashboardSecretario()` | Carrega a Home do Secretário com árvore hierárquica e dashboards |
| `carregarHierarquiaCompletaSecretario()` | Renderiza a árvore hierárquica completa da SEMAC |
| `carregarResumoTarefasSecretario()` | Carrega visão geral de tarefas na sidebar |
| `carregarGraficoDocumentosSecretario()` | Renderiza gráfico doughnut de Controle Processual |
| `carregarCalendarioProjetosSecretario()` | Renderiza calendário compacto de Projetos |
| `irParaProjetos()` | Navega para aba Projetos expandindo menu se necessário |
| `renderizarCardArvore(func, cor, tipo)` | Renderiza card de funcionário na árvore (grande) |
| `renderizarCardArvoreCompacto(func, cor, tipo)` | Renderiza card compacto (Fiscais/Equipe) |
| `abrirFormNovoFuncionarioPorCargo(cargo)` | Modal para cadastrar funcionário em qualquer cargo |
| `salvarNovoFuncionarioPorCargo()` | Salva novo funcionário validando hierarquia |
| `confirmarDesativarFuncionarioArvore()` | Modal de confirmação para desativação |
| `executarDesativarFuncionarioArvoreComTransferencia()` | Desativa funcionário com opção de transferir tarefas |
| `abrirEstatisticasEProdutividadeFiscal()` | Modal combinado com estatísticas e produtividade |
| `carregarDashboardDiretor()` | Carrega a Home do Diretor com gestão de Gerentes |
| `carregarGerentesHierarquiaDiretor()` | Lista todos os Gerentes |
| `abrirFormNovoGerente()` | Modal para cadastrar novo Gerente |
| `salvarNovoGerente()` | Salva Gerente no banco de dados |

### tarefas.js
| Função | Descrição |
|--------|-----------|
| `carregarTarefas()` | Carrega Kanban com filtros por perfil e modo |
| `carregarEventos()` | Carrega eventos com visibilidade por role |
| `abrirModalNovaTarefa()` | Modal de criação de tarefas (Diretor/Gerente/Secretário) |
| `toggleGerenciaPosturasSecretario()` | Gerencia sub-menu do Secretário |

---

## 🛠️ Correções Recentes (Março/2026)
- **Fix (salvarRegistro)**: Corrigida falha lógica onde categorias de produtividade comum (não CP) eram ignoradas pelo banco de dados devido a um erro de aninhamento de chaves no `isCP`.
- **Fix (Referência de Botão)**: Resolvido erro `ReferenceError` que impedia o carregamento do histórico quando o ouvinte do botão de limpeza tentava acessar funções removidas.
- **Sincronização**: Adicionado delay de 500ms pós-save para garantir que o Supabase finalize a escrita antes da releitura do histórico.
- **Refatoração do Histórico e Limpeza**: Ajustada a lógica de limpeza para zerar a pontuação do Controle Processual e restaurado o filtro global de pontuação > 0 no histórico pessoal.
- **Migração de E-mail (Google Apps Script)**: Substituído o envio via servidores externos por uma solução própria baseada em Google Apps Script, garantindo entrega direta e contornando bloqueios de rede/DNS.
- **Fix (UI/SweetAlert2)**: Corrigidos erros de concorrência e parâmetros inválidos na interface de carregamento do fechamento anual.
- **Implementação do Perfil Diretor**: Criado o papel de **Diretor de Meio Ambiente** com menu lateral expansível e alternância dinâmica de visualização na Home.
- **Robustez de Rede**: Migração de bibliotecas externas para a pasta local `lib/`, evitando erros de carregamento em redes com restrição de DNS (`ERR_NAME_NOT_RESOLVED`).
- **Calendário de Eventos**: Implementação completa do módulo de projetos com calendário vanilla JS e gestão de eventos.
- **Gestão de Bairros**: Novo sistema de cadastro de áreas, bairros e rotação de fiscais.
- **Alertas NP/AI**: Adicionada seção na Home para alertas de Notificações Preliminares e Autos de Infração vencidos.
- **Novo Cargo: Secretário(a)**: Implementação completa do perfil de Secretário com gestão de Diretores, sub-menu "Direção de Meio Ambiente" e sub-submenu "Gerência de Posturas".
- **Sidebar Rolável**: Implementação de scrollbar customizada na sidebar para quando o conteúdo excede a altura da tela.
- **Filtros de Tarefas por Perfil**: Sistema de filtros dinâmicos para Diretor e Secretário baseado no modo de visualização ativo.
- **Gestão Hierárquica**: Sistema completo de gestão em cascata: Secretário → Diretor → Gerente → Fiscal.
- **Cadastro Inteligente (Idempotência)**: Implementada verificação de existência por CPF nas funções de salvamento (`gerente.js`), permitindo a reativação de usuários inativos e evitando o erro 422 (*User already registered*).
- **Padronização de Domínio de E-mail**: Unificação de todos os e-mails de sistema para o domínio `@email.com` (ex: `cpf@email.com`), garantindo compatibilidade total com o mecanismo de login da `index.html`.
- **Robustez na Busca de Perfis (Fix PGRST116)**: Substituição global de `.single()` por `.maybeSingle()` em chamadas ao Supabase para evitar erros críticos de "0 rows" quando perfis de usuários recém-criados ainda não foram propagados ou estão ausentes.
- **Novo Cargo: Gerente de Regularização Ambiental**: Implementação completa do perfil GRA com dashboard de equipe, contadores por cargo (Eng. Agrônomos, Eng. Civis, Analistas, Auxiliares) e gestão de membros.
- **Gerência de Regularização Ambiental para Diretor**: Adicionado menu "Gerência de Regularização Ambiental" no sidebar do Diretor com toggle e dashboard da equipe ambiental.
- **Filtro de Tarefas GRA Corrigido**: Diretor no modo `gerencia_ambiental` agora vê tarefas onde a equipe RA é responsável (não apenas criadas por eles).
- **Estatísticas de Funcionários**: Cards da equipe GRA são clicáveis e abrem modal com estatísticas de tarefas (total, concluídas, pendentes, atrasadas).
- **Permissões SQL de Gestão**: Script `setup_permissoes_diretor_gerenciar.sql` permite que Diretor e Secretário cadastrem e desativem funcionários via funções RPC.
- **Remoção de Botão Duplicado**: Botão "Nova Tarefa" removido do container de home do GRA (já existe na aba Tarefas).

## 🆕 Atualizações Recentes (Março/2026)

### Dashboard do Secretário Reorganizado
- **Layout em Duas Colunas**: Árvore hierárquica (60%) + Dashboards (40%) para melhor aproveitamento de espaço
- **Árvore Hierárquica Visual**: Organograma completo da SEMAC com cards transparentes, bordas coloridas por cargo e conectores entre níveis
- **Contadores Discretos**: Removidos os cards grandes de totais do topo; agora exibidos como textos sutis embaixo de cada cargo ("3 diretores", "5 fiscais")
- **Botões "+ Novo" por Nível**: Cadastro rápido de funcionários em cada nível hierárquico (Diretores, Gerentes, Fiscais, Equipe Ambiental)
- **Desativação com Transferência**: Ícone de lixeira em cada card permite desativar funcionário com opção de transferir tarefas para outro

### Novos Dashboards na Sidebar
- **Visão Geral de Tarefas**: Cards com contadores de Pendentes, Em Progresso e Atrasadas + lista das 5 tarefas mais próximas
- **Controle Processual**: Gráfico doughnut mostrando distribuição de documentos por tipo nos últimos 30 dias (Notificações, Autos, Ofícios, etc)
- **Calendário de Projetos**: Mini-calendário mensal com dias destacados conforme eventos, lista dos 3 próximos eventos e navegação rápida para aba Projetos

### Gestão Hierárquica Completa
- Hierarquia visual: Secretário → Diretor → Gerente de Posturas/Fiscal e Gerente RA/Equipe Ambiental
- Cores por cargo: Roxo (Diretor), Verde escuro (Ger. Posturas), Azul (Ger. RA), Laranja (Fiscal), Verde (Equipe)
- Modal combinado para Fiscais: Estatísticas de tarefas + relatório de produtividade lado a lado

### Nova Hierarquia: Cuidado Animal
- **Diretor(a) do Cuidado Animal**: Dashboard com gestão de Gerentes e Coordenadores de CA
- **Gerente do Cuidado Animal**: Dashboard com gestão de Coordenadores de CA
- **Coordenador(a) do Cuidado Animal**: Acesso às tarefas atribuídas
- **Cores**: Rosa (`#db2777`) para Diretor, Rosa escuro (`#be185d`) para Gerente, Magenta (`#c026d3`) para Coordenador
- Menu expansível "Cuidado Animal" no sidebar do Diretor e Secretário
- Filtro de tarefas por modo `cuidado_animal`

### Cargos Especiais: Interface Jurídica e Administração
- **Novos Cargos**: "Gerente de Interface Jurídica" e "Agente de Administração"
- **Home Exclusiva**: Layout em duas colunas (Minhas Tarefas + Calendário de Projetos)
- **Permissões Restritas**: Apenas tarefas onde é responsável, atribuição somente para si mesmo
- **Sem Acesso**: Não podem criar projetos/eventos, não gerenciam equipes, não aparecem no ranking
- **Detecção por Normalização**: Sistema remove acentos automaticamente ("jurídica" → "juridica") para evitar conflitos de detecção
- **Menu Específico**: Sidebar simplificado com Home, Projetos (visualização) e Tarefas
