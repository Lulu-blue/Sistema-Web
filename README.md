# 🏛️ Sistema de Gestão da Fiscalização de Posturas

Sistema web para a Secretaria Municipal, migrando o controle de produtividade dos fiscais de planilhas LibreOffice para uma aplicação web moderna com Supabase.

---

## 📂 Estrutura de Arquivos

### Entry Points (raiz)
| Arquivo | Descrição |
|---------|-----------|
| `index.html` | Página de login (CPF com formatação em tempo real + senha) |
| `painel.html` | Dashboard principal (Home, sidebar + abas Produtividade/Históricos/Tarefas) |
| `redefinir-senha.html` | Página de redefinição de senha via token de segurança (válido por 1h) |

### Assets
| Pasta | Arquivos | Descrição |
|-------|----------|-----------|
| `assets/css/` | `style.css` | Estilos do login e fundo dinâmico de padrões (raminhos) |
| | `style_painel.css` | Estilos comuns do painel e sidebar |
| | `style_produtividade.css` | Estilo dos modais, gráficos, badge meta, tabela de relatórios e histórico |
| `assets/js/` | `script.js` | Lógica de autenticação via Supabase e geração do fundo da tela de login |
| | `protecao.js` | Conexão com Supabase centralizada + Redirecionamento de não logados |
| | `painel.js` | Lógica de troca de abas, controle de cargo, dados do perfil, upload de avatar, redefinição de senha e carregamento das Tarefas de Eventos na Home |
| | `produtividade.js` | Todo o motor de produtividade: gráficos, envio ao banco, manipulação de modal, formatação e lógicas WYSIWYG de exportação de documento |
| | `gerente.js` | **Gestão de Fiscais, Bairros/Áreas e Denúncias**: Ranking de desempenho, gráficos de pontuação, cadastro/exclusão de fiscais, visualização de documentos por tipo, **árvore hierárquica completa da SEMAC** para Secretários, **gestão de bairros e áreas** com rotação inteligente, **gráfico de peso por bairro** (NP/AI/Denúncias) com filtros e exportação Excel, e **Controle Interno de Denúncias** (6 tipos) com CRUD completo |
| | `tarefas.js` | Módulo completo de Tarefas e Calendário: Kanban, eventos, subtarefas, anexos PDF, permissões por role |
| | `projetos.js` | **Calendário de Eventos**: Lógica vanilla JS para calendário mensal, navegação entre meses, filtros por data e visualização de eventos |
| | `fechamento.js` | **Fechamento Anual**: Consolidação de registros em ZIP, geração de planilhas Excel formatadas, envio via Google Apps Script |
| | `cabecalho_img.js` | Módulo com a imagem do cabeçalho em Base64 para geração de documentos oficiais |
| `assets/img/` | `logoSemac.png`, `Cabeçalho.png`, `raminho.png`, `folhas.jpg` | Imagens e logos do sistema |

### Bibliotecas e Documentação
| Pasta/Arquivo | Descrição |
|---------------|-----------|
| `lib/` | **Pasta de Bibliotecas Locais**: Contém Supabase, Chart.js, SweetAlert2, html2pdf.js, JSZip, SheetJS (XLSX), Mammoth.js e outras dependências para garantir funcionamento offline ou em redes com restrição de DNS. |
| `PERMISSOES_SETUP.md` | **Guia definitivo** de permissões hierárquicas e políticas RLS (Row Level Security) do Supabase. Substitui todos os antigos arquivos `.sql` soltos. |

---

## 🔐 Autenticação e Perfis

- Login utiliza o **CPF** (`000.000.000-00`), traduzido internamente para e-mail e validado de ponta a ponta pelo Supabase.
- Baseado em **Cargos (Roles)** via tabela `profiles`:
  - **Admin**: Acesso a configurações globais (Visão de gestão futura).
  - **Fiscal**: Acesso liberado às abas **Home**, **Produtividade**, **Histórico (Pessoal)** e **Histórico Geral**.
  - **Diretor de Meio Ambiente**: Perfil de supervisão com interface dinâmica. Possui menu lateral expansível ("Gerência de Posturas") e visão de gestão de produtividade da equipe.

### Perfis de Usuário (Roles)

O sistema possui **10+ cargos distintos** com permissões específicas:

| Cargo | Permissões Principais |
|-------|----------------------|
| **Admin** | Acesso total, incluindo gerenciamento de usuários |
| **Fiscal** | Produtividade, Histórico Pessoal, Histórico Geral, Tarefas |
| **Fiscal de Posturas** | Mesmas permissões do Fiscal (variação de cargo) |
| **Fiscal de Meio Ambiente** | Produtividade ambiental, acesso à categoria 1.2.MA (Auto de Infração Ambiental), Tarefas |
| **Gerente Fiscal** | Histórico Geral, Bairros, visão de gestão de fiscais |
| **Gerente de Posturas** | Projetos, Bairros, Tarefas, Calendário de Eventos |
| **Gerente de Regularização Ambiental** | Gestão de equipe ambiental (Eng. Agrônomos, Eng. Civis, Analistas, Auxiliares), gestão do Consórcio, Tarefas, Calendário |
| **Administrativo de Posturas** | Acesso ao Histórico Geral (visor apenas) |
| **Diretor de Meio Ambiente** | Acesso total com menus expansíveis "Gerência de Posturas" e "Gerência de Regularização Ambiental", alternância entre modos Direção e Gerência |
| **Secretário(a)** | Acesso total com menu expansível "Direção de Meio Ambiente", gestão de Diretores, criação de tarefas para qualquer usuário |
| **Gerente de Interface Jurídica** | Tarefas próprias (criar/ver apenas onde é responsável), visualização de projetos, **sem** gestão de equipe |
| **Consórcio** | Criação e visualização de tarefas, atribuição para Analistas do Consórcio, criação de subtarefas em tarefas próprias, **sem** acesso a Eventos |
| **Analista do Consórcio** | Tarefas atribuídas pelo Consórcio, visualização de tarefas onde é responsável, **sem** gestão de equipe |
| **Agente de Administração** | Tarefas próprias (criar/ver apenas onde é responsável), visualização de projetos, **sem** gestão de equipe |
| **Estagiário do Agente de Administração** | Mesmas permissões do Agente de Administração |

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

### Expiração de Sessão (12 Horas)
Por segurança, toda sessão de usuário possui um **limite máximo contínuo de 12 horas**, independentemente da renovação automática de tokens do Supabase.

- **Como funciona**: no momento do login (`assets/js/script.js`), um timestamp (`semac_session_start`) é salvo no `localStorage` do navegador.
- **Verificação**: o guardião de rotas (`assets/js/protecao.js`) checa esse timestamp em três momentos:
  1. Ao carregar qualquer página protegida (`verificarAcesso()`).
  2. Durante monitoramento reativo de estado de autenticação (`onAuthStateChange`).
  3. Antes de operações críticas, como salvar dados (`garantirSessaoAtiva()`).
- **Comportamento ao expirar**: se o tempo decorrido ultrapassar 12 horas, o sistema executa `signOut()`, remove o timestamp e redireciona para `index.html` com o aviso:
  > *"Sua sessão expirou após 12 horas por segurança. Por favor, faça login novamente."*

---

## 📊 Home / Visão Geral

- Fiscais recebem no início (aba **Home**) um resumo rápido:
  - **Gráfico de Produtividade Diária (Chart.js)**: Gráfico de barras combinando contagem por dia e uma linha para pontos acumulados, com linha indicadora da meta.
  - **Resumo de Pontuação**: Exibe os pontos totais e notificações de conclusão.
  - **Destaque Dinâmico (Meta 2000)**: Quando a soma dos pontos atinge 2000 no mês, um badge dourado pulsante "*🏆 META ATINGIDA*" é exibido.
  - **Botão "Gerar Relatório"**: Processa no navegador um **relatório HTML editável** (com a data de pesquisa, agrupado por categorias e subtotais) com botão para Salvar em formato PDF. O título do relatório insere automaticamente o "Mês/Ano" corrente baseado no dia de fechamento (até dia 7 = mês anterior, pós-dia 7 = mês atual).
- **Botão "Limpeza Geral"**: Localizado ao lado do relatório, permite que o fiscal limpe permanentemente seus dados de **meses anteriores**. Registros do **mês atual** são mantidos intocados.
    - **Produtividade Normal**: registros de meses passados em `registros_produtividade` são excluídos permanentemente.
    - **Controle Processual**: a pontuação (`pontuacao`) de registros de meses passados em `controle_processual` é zerada — os documentos oficiais (Notificações, Autos, Ofícios, etc) **NÃO são apagados** e continuam visíveis no Histórico Geral.
    - O filtro de mês é baseado no `created_at` e usa o mês calendário atual (sem aplicar a regra dos 7 dias).
- **Alerta de Encerramento Mensal**: Um banner verde translúcido aparece automaticamente no topo da Home no **último dia de cada mês**, lembrando o fiscal de gerar seu relatório antes da virada do calendário.
- **Visão de Diretoria (Home)**: Quando o **Diretor de Meio Ambiente** expande o menu de gestão, a Home alterna automaticamente para exibir os gráficos de desempenho dos fiscais e outras ferramentas de supervisão.

---

## 📊 Relatório Individual do Fiscal (Gestão)
- **Acesso**: Clique no nome do fiscal no ranking de desempenho (Home do Gerente/Diretor).
- **Dados exibidos**: Todos os registros de produtividade e controle processual do fiscal selecionado.
- **Filtragem por período**: Visualização dos últimos 30 dias por padrão.
- **Pontuação detalhada**: Soma de pontos por categoria e total acumulado.

---

## 🗂️ Históricos e Gestão de Documentos Avançada
- Os Fiscais agora possuem total autonomia para **Editar seus próprios registros diretamente através da aba Histórico Geral**.
- **Gerenciador de Anexos**: No detalhamento do documento, os criadores do registro podem substituir o documento PDF principal sem corromper a pontuação e também fazer upload de múltiplos arquivos `.pdf/.jpg` na nova área de "Documentos Adicionais".
- A pesquisa unificada abrange desde dados extraídos como Nome e Bairro até o próprio `N° Sequencial` (`001/2026`) diretamente do banco.
- **Auto de Infração**: O recolhimento do CPF agora é **obrigatório**, e o valor é mapeado dinamicamente para exibição e geração do PDF final oficial do Auto.

---

## 📅 Fechamento Anual (`fechamento.js`)
- **Mecanismo de Consolidação Bypass**: Reúne todos os registros de produtividade e controle processual do ano vigente contornando o limite nativo de paginação de 1000 registros do banco de dados (através de iteração em chunks dinâmicos).
- **Processamento em Background (Silencioso)**: O download ocorre em segundo plano com uma barra de progresso não-bloqueante na UI. Isso permite o livre uso do painel enquanto os arquivos são puxados e inclui um **Botão de Cancelamento** instantâneo da operação.
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

### Tabela "Tarefas de Eventos" na Home
- Aparece para **todos os usuários** (fiscais e gerentes) logo abaixo dos gráficos como "Tarefas de Eventos".
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
| Consórcio | ✗ (sem acesso) | ✗ | ✗ |
| Cargos Especiais* | Apenas onde é responsável (Tarefas de Eventos) | ✗ | ✗ |

\* **Cargos Especiais**: Gerente de Interface Jurídica, Agente de Administração, Estagiário do Agente de Administração

---

## 🗺️ Módulo de Bairros e Áreas (`gerente.js`)

Gestão completa de áreas de atuação, mapeamento de bairros para fiscais, e controle interno de denúncias.

### Áreas de Atuação
- **Cadastro de áreas**: Nome da área e fiscal responsável.
- **Lista de áreas**: Visualização com fiscal vinculado, quantidade de bairros, e totais de NP / AI / Denúncias por área.
- **Edição/Exclusão**: Modificar dados ou remover áreas existentes.

### Mapeamento de Bairros
- **Cadastro de bairros**: Nome do bairro, área vinculada.
- **Ordenação de áreas**: Áreas exibidas em ordem crescente numérica (`Área 1`, `Área 2` … `Área 10`).
- **Agrupamento de bairros**: Bairros ordenados primeiro por área (numérico) e, dentro de cada área, em ordem alfabética. Bairros sem área ficam ao final.
- **Busca rápida**: Filtro de bairros por nome.
- **Contador**: Total de bairros cadastrados.
- **Normalização inteligente de nomes**: Ao contar ocorrências por bairro, o sistema ignora diferenças de maiúsculas/minúsculas, remove acentos e despreza o prefixo "Bairro" (ex: "Bairro Centro" e "CENTRO" são agrupados no mesmo bairro).
- **Registros sem bairro ignorados**: Registros onde o campo bairro está NULL ou vazio não aparecem no gráfico nem nas contagens.

### 🗺️ Mapa Geográfico Interativo
- **Integração Leaflet**: Mapa dinâmico integrado para visualização da distribuição de bairros por área.
- **Fallback Inteligente — Pontos para Polígonos**: 
  - Por padrão, exibe **círculos** (`L.circleMarker`) nas coordenadas de latitude/longitude cadastradas no banco.
  - Se um arquivo GeoJSON com polígonos reais dos bairros for disponibilizado em `assets/geojson/bairros_divinopolis.geojson`, o sistema renderiza as **fronteiras dos bairros** coloridas por área.
  - Bairros que possuem polígono no GeoJSON têm seu ponto ocultado automaticamente; bairros sem polígono continuam como círculo.
  - Isso permite uma migração gradual — adicione polígonos aos poucos sem quebrar o mapa.
- **Camadas Organizadas (LayerGroups)**: Marcadores e polígonos são gerenciados em `L.layerGroup` separadas, permitindo limpeza eficiente, destaque por área e atualização dinâmica sem duplicação.
- **Lista Lateral Integrada**: Menu lateral sobreposto ao mapa que lista todos os bairros classificados por área.
- **Legenda de Áreas Dinâmica**: Painel flutuante indicando a cor e o fiscal responsável por cada área (ex: Área 1 - Fiscal João).
- **Clique Seguro no Mapa**: Ao selecionar um bairro na lista para posicionar no mapa, cliques acidentais em marcadores ou popups são ignorados. O bairro é desselecionado automaticamente após o salvamento da coordenada.
- **Responsive Mobile Mode**: 
  - Em telas menores, o mapa inline é substituído pelo botão **"🗺️ Ver Mapa"**.
  - O clique abre o mapa em **Overlay Fullscreen**, impedindo a rolagem acidental e desconfiguração do layout principal durante o "arrastar" do dedo.
  - Sidebar e Legenda ganham botões de "Minimizar/Expandir" para liberar mais espaço visível no celular.
  - Zoom de duplo clique desabilitado via `L.DomEvent` para não acionar zoom out nativo do iOS/Android durante navegação tátil.
  - Mapa mobile replota marcamentos a cada abertura, garantindo sincronização com dados atualizados.

### Sistema de Rotação
- **Rotação de Áreas (Fiscais)**: Troca automática de fiscais entre áreas de atuação. **Não utiliza peso de denúncias** — apenas distribui os fiscais existentes.
- **Rotação Inteligente de Bairros**: Redistribuição automática de bairros entre áreas baseada no **peso total (NP + AI + Denúncias)** dos últimos 30 dias. Bairros mais pesados são distribuídos para balancear a carga entre as áreas.
- **Painel visual**: Interface dedicada para gerenciar rotações, com backup automático no `localStorage` e opção de reversão.

### Gráficos Estatísticos
- **Peso por Bairro**: Gráfico de barras verticais com os Top 10 bairros mais problemáticos, combinando **NP + AI + Denúncias**.
  - **Filtros dinâmicos**: Botões para alternar entre `Todos`, `NP`, `AI` e `Denúncias`.
  - **Sub-filtros de denúncias**: Quando o filtro "Denúncias" está ativo, aparecem botões para filtrar por tipo específico (Comunicação Interna, Vereadores, MP, APP, Ouvidoria, Protocolo).
- **Modal "Ver Todos"**: Gráfico completo em barras verticais exibindo **todos os bairros**, respeitando o filtro ativo.
- **Download Excel**: Exporta os dados do gráfico em `.xlsx` com as colunas Bairro, NP, AI, Denúncias e Peso Total.

### 📢 Controle Interno de Denúncias
Módulo com 6 sub-abas independentes para acompanhamento de demandas externas:
- **Comunicação Interna**, **Vereadores**, **MP**, **APP**, **Ouvidoria**, **Protocolo**
- **CRUD completo**: Formulário modal para criar/editar/excluir registros por tipo.
- **Campos por tipo**: Protocolo usa `protocolo` + `solicitante`; os demais usam `tarefa` + `origem`.
- **Área de Preservação Permanente (APP)**: Coluna e campo em **todos os tipos de denúncia**. No formulário de criação/edição, exibe select **Sim/Não** (default: **Não**). Na tabela, exibe badge "Sim" (verde) ou "Não" (cinza).
- **Campo Bairro (Multi-seleção)**: No formulário de denúncias, o campo Bairro permite selecionar **um ou mais bairros** via checkboxes com busca/filtro. Os bairros são salvos como string separada por vírgula e cada um é contabilizado individualmente no peso dos gráficos de bairros.
- **Botão "Área de Preservação Permanente"**: Botão exclusivo acima das sub-abas que abre modal com todos os registros (de todos os tipos) marcados como `app_preservacao = true`.
  - **Modal com filtros completos**: Popup "Filtro" com Origem, Responsável, Tipo, Status, Prazo, Data Início/Fim + busca textual global + datalists dinâmicos.
  - **Download CSV**: Exportação `.csv` diretamente do modal, com colunas completas e BOM UTF-8.
- **Filtros e Busca Avançados na tabela comum**: 
  - Botão de popup unificado ("Filtro") para evitar que elementos cortem em telas menores (mobile-friendly).
  - Busca textual global.
  - Filtros de **Origem** e **Responsável** via inputs textuais com **autocomplete** (datalists dinâmicos).
  - Filtros por **Período** (Data Início / Data Fim) e status de **Prazo** (Vencido / No Prazo).
  - Ao trocar de sub-aba, os filtros são limpos automaticamente garantindo visualização integral da aba.
- **Download CSV na tabela comum**: Botão "Baixar CSV" exporta todos os registros da aba ativa em formato `.csv` com separador `;` e BOM UTF-8.
- **Campo Bairro**: Datalist populada com os bairros cadastrados, permitindo também texto livre.
- **Identificação do Criador**: Na tabela, abaixo dos botões de ação, o sistema exibe discretamente "Por: Nome" identificando o criador.
- **Destaques visuais automáticos**: Registros concluídos (`concluido = true`) ficam em verde claro. Registros com prazo vencido e não concluídos ficam com fundo vermelho claro.

---

## 📝 Sistema de Produtividade

O sistema possui **36 categorias** divididas em Grupos (Cores diferentes):
1. **Controle Processual (1.1° a 6.2°)**: Ficam numa área destacada (cards escuros verdes translucientes).
2. **Atividades Gerais (2° a 30°)**: Ficam nos blocos padrão (cards verdes claros).

### Funcionalidades Especiais:
- **Tabelas Distintas no Supabase**: 
  - *Registros comuns* vão para a tabela `registros_produtividade`.
  - *Controle Processual* vai para a tabela separada `controle_processual`.
- **Anexo Automático em PDF e Editor WYSIWYG**: Toda categoria oficial "Geradora de Documento" (Auto de Infração, Ofício, Relatório, Réplica e Certidão) exibe o botão **Gerar Documento** ao invés do upload manual padrão. O preenchimento da modal não vai ao banco de dados imadiatamente; invoca-se um Mini-Editor (Modal editável) que mostra de antemão um formato A4 timbrado preenchido automaticamente com nome, matrícula do fiscal, numeração, dados e datas. O sistema aciona o `html2pdf.js` forçando um download local `.doc/.pdf` e, em segundo plano, acopla silenciosamente esse formulário digital PDF e envia ao Storage em nuvem.
- **Segurança de Documentos no Histórico**: Por tratar-se de peças geradoras de PDF físico baseadas em dados doWYSIWYG, a aba de **Histórico** inibe a edição de Registros dessas naturezas ("Auto de Infracao", "Ofício", "Relatório", "Réplica", "Certidão") protegendo o dado bruto imutável. Caso o usuário cometa um erro de envio, precisará apagar o item por completo e regerar, mantendo a integridade perante o espelho em PDF oficial.
- **Auto-Preenchimento por Leitura IA de Word**: As categorias (ex. Notificação Preliminar e Protocolo) não necessitam preenchimento braçal graças à função inovadora "*Preenchimento Automático (Word)*". Utilizando o plugin local `mammoth.js`, o sistema varre o arquivo original DOCX submetido pelo fiscal instigando uma Extrator de Regex em busca de blocos cruciais no texto emulando NLP (buscando N° de Notificação/Protocolo, Contribuinte, Bairro, Inscrição etc) e repassa os dados instantaneamente para os inputs visuais da UI (e automaticamente preenche o arquivo DOCX original como anexo) em 1 segundo, reduzindo atritos de digitação manual de forma monstruosa.
- **Campo de Dropdown Persistente Avançado**: A categoria permite dropdowns selecionáveis onde "Outro..." abre criação de motivos customizados, salvos localmente num array próprio, limpáveis pela Lixeira "🗑" e selecionáveis sem interrupção através de manipulação de DOM para impedir perda de focus no input de texto.
- **Numeração Automática**: Algumas atividades de Processual (ex. Ofício e Auto de Infração) puxam sequenciado pelo maior número que o fiscal executou naquele tipo (ex. `0116/2026`).
- **Calculadora de Horas**: Certas rotinas geram pontos multiplicando o "horas gastas" * "fator (ex 30pts/h)".
- **Automação de Produtividade**: Para evitar retrabalho, o preenchimento de certas categorias-chave de Controle Processual gera automaticamente a pontuação de suas categorias associadas de expedição/elaboração. As pontuações são somadas e consolidadas silenciosamente no banco de dados. As regras ativas são:
  - **Notificação Preliminar (16.1)** gera automaticamente **Notificação Preliminar expedidos (14)** (Total: 25 pts).
  - **Auto de Infração (16.2)** gera automaticamente **Autos de Infração expedidos (15°)** (Total: 35 pts).
  - **Ofício (16.4)** gera automaticamente **Elaboração de Ofícios (7°)** (Total: 25 pts).
  - **Relatório Fiscal (16.5)** gera automaticamente **Elaboração de Certidão de Arquivamento e Relatório Fiscal (6°)** como tipo Relatório Fiscal (Total: 60 pts).
- **Data Registrada e Período de Ajuste (Corte do Mês)**:
  - O corte mensal para definição do "mês corrente" no relatório foi alterado do **dia 3** para o **dia 7** de cada mês. Até o dia 7, o sistema considera o mês anterior como período ativo.
  - Durante os **primeiros 7 dias de cada mês**, os fiscais podem informar uma **data anterior** ao criar ou editar um registro. Um campo `datetime-local` aparece automaticamente no formulário, permitindo ajustar o `created_at` para qualquer dia do mês anterior (ou do próprio mês, desde que não seja data futura).
  - **Novo registro**: o campo é pré-preenchido com o horário atual, mas pode ser alterado.
  - **Edição**: o campo exibe a data/hora salva originalmente e permite modificação dentro do período de ajuste.
  - Fora do período de 7 dias, o campo fica oculto e o sistema usa a data atual automaticamente.

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

## ✅ Módulo de Tarefas (`tarefas.js`)

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
  - **Criador da tarefa** (`Por [Nome]`) visível no card e no modal.
  - Avatares circulares + nomes dos responsáveis (foto do perfil ou ícone SVG placeholder).
  - Prazo com cor dinâmica (vermelho=atrasada, amarelo=próxima, cinza=normal).
  - Barra de progresso de subtarefas com porcentagem.
  - **Lista de subtarefas** com checkboxes interativos (só para tarefas do próprio usuário ou gerente).
- **Criar tarefa** (gerente): modal com título, descrição, prazo, responsáveis (checkboxes com lista de fiscais/gerentes).

### Modal de Detalhe da Tarefa
- **Botões de status**: Pendente / Em Progresso / Concluída — visíveis para responsáveis, criador ou gerentes.
- **Descrição**: exibida em bloco estilizado se existir.
- **Responsáveis**: chips com foto de perfil circular + nome.
- **Prazo**: data formatada em pt-BR.
- **Subtarefas**: lista com checkboxes, nome do responsável designado, botão de anexar PDF e link para anexos já enviados.
- **Anexos**: seção para upload de PDF + listagem com link clicável e botão de excluir.
- **Comentários**: chat interno na tarefa. Qualquer responsável ou criador pode comentar, com suporte a **múltiplos anexos por comentário**.
- **Visualizações**: indicador "✓ Visualizou [dd/mm/aaaa, hh:mm]" mostra quando cada responsável abriu a tarefa ou subtarefa.
- **Editar tarefa**: botão visível **apenas para o criador** e **somente dentro de 24h** após a criação. Abre o mesmo modal de criação preenchido com os dados salvos (título, descrição, prazo, responsáveis), permitindo adicionar novos anexos. Após o prazo, o botão some automaticamente.
- **Excluir tarefa**: botão visível **apenas para o criador** e **somente dentro de 24h** após a criação. Após esse prazo, o botão não aparece mais.

### Subtarefas
- **Criar subtarefa** (gerente, criador ou responsável pela tarefa pai): mini-modal com título, seletor de responsável, descrição opcional e anexo opcional.
- **Editar subtarefa**: botão visível **apenas para o criador** da subtarefa e **somente dentro de 24h** após a criação. Abre o mesmo modal de criação preenchido com os dados salvos (título, descrição, responsáveis), permitindo adicionar um novo anexo.
- Cada subtarefa pode ter:
  - **Múltiplos responsáveis** (exibido com ícone SVG).
  - **Anexo PDF** (botão de upload direto na subtarefa).
- **Checkbox** para marcar como concluída (apenas se o usuário é responsável da tarefa-pai ou gerente).
- **Reversão automática**: excluir o último anexo de uma subtarefa concluída reverte seu status automaticamente para **pendente**.
- **Barra de progresso**: porcentagem de subtarefas concluídas visível nos cards e no modal.

### Sistema de Notificações (`painel.js`)
- **Notificações em tempo real**: sininho na sidebar só aparece quando há notificações não lidas.
- **Eventos que geram notificação**:
  - Novo comentário em tarefa onde o usuário é responsável ou criador.
- **Clique na notificação**: marca como lida e abre o modal da tarefa correspondente.
- **Auto-hide**: o sininho some automaticamente quando o count chega a zero.

### Upload de Anexos e Sanitização
- **Sanitização automática**: nomes de arquivo com acentos ou espaços são normalizados antes do upload para o Supabase Storage (`tarefa_anexos`), evitando erros de `Invalid key`.
- **Status automático**: anexar um arquivo a uma tarefa com status **pendente** muda seu status automaticamente para **em_progresso**.

### Permissões por Role

| Ação | Fiscal | Gerente/Admin | Diretor de Meio Ambiente | Secretário(a) | Gerente RA | Consórcio | Cargos Especiais* |
|------|--------|---------------|--------------------------|---------------|------------|-----------|-------------------|
| Ver tarefas no Kanban | Só as suas | Todas | Todas | Todas | Só da equipe RA | Próprias + Analistas | Só onde é responsável |
| Alterar status | Apenas das suas | Todas | Todas | Todas | Todas | Próprias + Analistas | Apenas das suas |
| Criar tarefa | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (apenas para si) |
| Criar evento/projeto | ✗ | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ |
| Criar subtarefa | Só nas suas | ✓ | ✓ | ✓ | ✓ | ✓ (só nas próprias) | Só nas suas |
| Editar tarefa | ✗ | Só as próprias (≤24h) | Só as próprias (≤24h) | Só as próprias (≤24h) | Só as próprias (≤24h) | Só as próprias (≤24h) | Só as próprias (≤24h) |
| Editar subtarefa | ✗ | Só as próprias (≤24h) | Só as próprias (≤24h) | Só as próprias (≤24h) | Só as próprias (≤24h) | ✗ | ✗ |
| Excluir tarefa | ✗ | Só as próprias (≤24h) | Só as próprias (≤24h) | Só as próprias (≤24h) | Só as próprias (≤24h) | Só as próprias (≤24h) | Só as próprias (≤24h) |
| Marcar subtarefa como concluída | Só nas suas tarefas | Todas | Todas | Todas | Todas | ✗ | ✗ |
| Anexar PDF em subtarefa | Só nas suas tarefas | Todas | Todas | Todas | Todas | ✗ | ✗ |
| Comentar em tarefa | Só nas suas | Todas | Todas | Todas | Todas | Só nas suas | Só nas suas |
| Ver eventos/projetos | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ (onde é responsável) |
| Gerenciar Gerentes | ✗ | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ |
| Gerenciar Diretores | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ |
| Gerenciar Equipe Ambiental | ✗ | ✗ | ✓ | ✓ | ✓ | ✗ | ✗ |
| Cadastrar Funcionários | ✗ | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ |
| Desativar Funcionários | ✗ | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ |

\* **Cargos Especiais**: Gerente de Interface Jurídica, Agente de Administração, Estagiário do Agente de Administração

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
A segurança ocorre camada a camada no banco de dados. O sistema possui **14 tabelas ativas com RLS** e mais de **80 políticas** configuradas. As principais regras são:

- **`registros_produtividade`**: Fiscais inserem/leem/editam apenas os próprios registros (`user_id = auth.uid()`). Gerência visualiza tudo.
- **`controle_processual`**: Todos os logados visualizam (*SELECT* livre). Updates/Deletes restritos ao dono do registro ou a admins/gerentes.
- **`profiles`**: Tabela mais complexa (26 políticas). Hierarquia rigorosa — Secretários têm gestão total, Diretores gerenciam Gerentes e abaixo, Gerentes gerenciam Fiscais e abaixo. Cada usuário pode editar o próprio perfil.
- **`tarefas`**: Leitura livre para autenticados. Edição/exclusão controlada por `is_chefe()`, cargo hierárquico ou ser o criador. Cargos especiais (Jurídico, Administração) veem apenas as próprias tarefas.
- **`notificacoes`**: Cada usuário vê apenas as próprias notificações (`user_id = auth.uid()`).
- **Buckets de Storage** (`anexos`, `avatars`, `tarefa_anexos`): Upload/download para usuários autenticados. Arquivos organizados em pastas por `user_id`.

> 📋 **Para o catálogo completo de todas as políticas RLS por tabela**, consulte o arquivo **`PERMISSOES_SETUP.md`** (Anexo B).

### `eventos` (Módulo de Tarefas)
Tabela de eventos do calendário. Campos: `titulo`, `descricao`, `data_inicio`, `data_fim`, `cor` (hex), `criado_por` (FK → auth.users), `responsavel_id`, `tipo` (`evento`/`projeto`), `localizacao`, `parcerias` (JSONB), `orcamentos` (JSONB), `patrocinios` (JSONB), `responsaveis` (texto).

### `tarefas` (Módulo de Tarefas)
Tabela de tarefas e subtarefas. Campos: `titulo`, `descricao`, `status` (pendente/em_progresso/concluida), `prazo` (date), `criado_por`, `tarefa_pai_id` (FK → tarefas, para subtarefas), `evento_id` (FK → eventos). RLS permite leitura para todos autenticados. Todas as foreign keys possuem `ON DELETE CASCADE`.

### `tarefa_responsaveis` (Módulo de Tarefas)
Relação N:N entre tarefas e usuários. Campos: `tarefa_id` (FK → tarefas), `user_id` (FK → auth.users), `user_name` (texto desnormalizado para display rápido).

### `tarefa_anexos` (Módulo de Tarefas)
Anexos PDF vinculados a tarefas/subtarefas. Campos: `tarefa_id` (FK → tarefas), `nome_arquivo`, `url` (public URL do Storage), `uploaded_by` (FK → auth.users).

### `tarefa_comentarios` (Módulo de Tarefas)
Comentários em tarefas e respostas. Campos: `tarefa_id` (FK → tarefas), `resposta_id` (FK → tarefa_respostas, opcional), `user_id` (FK → auth.users), `user_name`, `texto`, `anexo_url`, `anexo_nome`, `created_at`.

### `tarefa_respostas` (Módulo de Tarefas)
Respostas individuais dos responsáveis em tarefas principais. Permite múltiplas respostas por tarefa, cada uma com seu autor. Campos: `tarefa_id` (FK → tarefas), `user_id` (FK → auth.users), `user_name`, `texto`, `created_at`.

### `tarefa_comentario_anexos` (Módulo de Tarefas)
Anexos vinculados a comentários (suporte a múltiplos arquivos por comentário). Campos: `comentario_id` (FK → tarefa_comentarios), `nome_arquivo`, `url`, `uploaded_by`.

### `tarefa_visualizacoes` (Módulo de Tarefas)
Registro de quando cada responsável visualizou uma tarefa ou subtarefa. Campos: `tarefa_id` (FK → tarefas), `user_id` (FK → auth.users), `visualizado_at`. Chave composta (`tarefa_id`, `user_id`).

### `notificacoes`
Sistema de notificações internas. Campos: `user_id` (FK → auth.users), `tipo` (ex: `comentario_tarefa`), `titulo`, `mensagem`, `tarefa_id` (FK → tarefas, opcional), `lida` (boolean), `created_at`.

### `areas_atuacao` (Módulo de Bairros)
Tabela de áreas de atuação dos fiscais. Campos: `nome`, `fiscal_id` (FK → auth.users), `created_at`.

### `bairros` (Módulo de Bairros)
Tabela de bairros mapeados. Campos: `nome`, `area_id` (FK → areas_atuacao), `fiscal_id` (FK → auth.users), `created_at`.

### `controle_denuncias` (Controle Interno de Denúncias)
Tabela única para registro e acompanhamento de demandas internas (Comunicação Interna, Vereadores, MP, APP, Ouvidoria, Protocolo). Campos: `tipo` (text, com check constraint), `data` (date), `tarefa` (text), `protocolo` (text), `origem` (text), `solicitante` (text), `descricao` (text), `endereco` (text), `bairro` (text), `encaminhado_para` (FK → auth.users), `encaminhado_para_nome` (text), `prazo_conclusao` (date), `data_entrega` (date), `obs` (text), `concluido` (boolean), `app_preservacao` (boolean, default false), `created_by` (FK → auth.users).

### `exclusao_logs` (Auditoria)
Tabela de logs de exclusão de usuários. Substituíu a antiga `log_exclusoes`. Campos: dados do registro de auditoria.

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
   Diretor MA         Diretor CA      [Cargos Especiais]
         │                 │              (embaixo)
    ┌────┴────┐            │
    │         │            │
 Post.      Amb.      Gerente CA
    │         │            │
 Fisc.   ┌───┴───┐    Coordenadores
         │       │
      Equipe  Consórcio
         │       │
                Analistas
```

**Características da visualização:**
- **Diretor de Meio Ambiente**: Expandido horizontalmente com duas colunas internas (Posturas e Ambiental)
- **Gerência de Posturas**: Coluna com Gerentes → Fiscais (grid 2 colunas)
- **Gerência Ambiental**: Coluna com Gerentes → Equipe RA (grid 2 colunas) + Consórcio + Analistas do Consórcio
- **Diretor do Cuidado Animal**: Coluna única com Gerente → Coordenadores
- **Consórcio e Analistas**: Coluna à direita dentro da Gerência Ambiental, com linha horizontal azul conectora
- **Cargos Especiais (RH/ADM e Jurídico)**: Seção separada embaixo de toda a hierarquia
- **Cores por hierarquia**:
  - Secretário: `#1e3a5f` (azul escuro)
  - Diretor MA: `#7c3aed` (roxo)
  - Gerência Posturas: `#0c3e2b` (verde escuro)
  - Fiscais: `#b45309` (laranja)
  - Gerência Ambiental: `#1e3a5f` (azul)
  - Equipe RA: `#065f46` (verde)
  - Consórcio: `#d97706` (âmbar)
  - Analistas do Consórcio: `#f59e0b` (âmbar claro)
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
 │    ├── Gerente de Posturas (nível 2) → Fiscal de Posturas (nível 1)
 │    └── Gerente de Regularização Ambiental (nível 2)
 │         ├── Fiscal de Meio Ambiente (nível 1)
 │         ├── Equipe Ambiental (nível 1)
 │         ├── Consórcio (nível 1)
 │         └── Analista do Consórcio (nível 1)
 │
 ├── Diretor(a) do Cuidado Animal (nível 3)
 │    └── Gerente do Cuidado Animal (nível 2)
 │         └── Coordenador(a) do Cuidado Animal (nível 1)
 │
 ├── Gerente de Interface Jurídica (Cargo Especial)
 └── Agente de Administração (Cargo Especial)
      └── Estagiário do Agente de Administração (Cargo Especial)
```

> **Nota**: Cargos Especiais (Gerente de Interface Jurídica, Agente de Administração, Estagiário do Agente de Administração) **não fazem parte da hierarquia de gestão**. Eles têm acesso apenas às próprias tarefas e não gerenciam equipes.

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
- **Clicar no botão principal (menu fechado)**: Abre o menu e vai para a Home do modo correspondente
- **Clicar no botão principal (menu aberto + não está na Home)**: Apenas vai para a Home do modo mantendo o menu aberto
- **Clicar no botão principal (menu aberto + já está na Home)**: Fecha o menu completamente e volta para modo normal
- **Clicar no botão principal (menu aberto + sub-submenu aberto)**: Fecha apenas o sub-submenu, mantém o menu aberto e vai para a Home do modo
- **Clicar em "Gerência de Posturas" / "Gerência de Regularização Ambiental" / "Cuidado Animal" / "Jurídico" / "RH"**: Segue o mesmo padrão de toggle acima
- **Clicar fora do menu**: Fecha todo o menu, volta para modo normal

> **Nota:** Qualquer botão com submenu requer **dois cliques para fechar** quando o usuário já está na Home daquele modo. O primeiro clique sempre garante que o usuário esteja na Home correta mantendo o menu aberto; o segundo clique fecha o menu.

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
| `normal` | Apenas tarefas onde o Secretário é responsável ou criador |
| `direcao` | Tarefas de Diretores |
| `gerencia_posturas` | Tarefas criadas por Gerentes de Posturas (sub-modo) |
| `gerencia_ambiental` | Tarefas criadas por Gerentes RA **OU** onde equipe RA é responsável |

#### Gerente de Regularização Ambiental
- Vê tarefas que **criou** OU onde é **responsável**
- Pode criar tarefas para qualquer membro da equipe ambiental e para o Consórcio
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
| **Consórcio** | Parceiro externo para execução de serviços ambientais |
| **Analista do Consórcio** | Analista vinculado ao Consórcio para tarefas específicas |

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
| **Estagiário do Agente de Administração** | Suporte às tarefas administrativas internas |

### Características dos Cargos Especiais:

#### 🏠 Home Exclusiva
- **Layout em duas colunas**:
  - **Esquerda**: Tarefas de Eventos (apenas onde é responsável)
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

> **Nota:** Os antigos arquivos `.sql` soltos (`setup_permissoes_diretor_gerenciar.sql`, `setup_permissoes_secretario.sql`, etc.) foram consolidados em **`PERMISSOES_SETUP.md`**. Consulte esse arquivo para o catálogo completo de políticas RLS, funções SQL e scripts de configuração.

### Resumo das Funções SQL Existentes

| Função | Descrição | Quem pode usar |
|--------|-----------|----------------|
| `is_diretor_ou_secretario(user_id)` | Verifica se usuário tem permissão de gestão | Interno |
| `is_secretario_ou_dev(user_id)` | Verifica se é Secretário ou Dev | Interno |
| `criar_novo_usuario(email, senha, nome, cargo, cpf, matricula)` | Cria usuário completo (auth.users + profiles) | Secretário/Dev |
| `desativar_usuario(user_id)` | Soft delete (marca como inativo) | Secretário/Dev |
| `excluir_usuario_permanente(user_id)` | Hard delete (apenas Devs) | Desenvolvedor |
| `pode_excluir_usuario(user_id)` | Verifica se o usuário atual pode excluir o alvo | Interno (RLS) |
| `pode_gerenciar_usuario(manager_id, target_id)` | Verifica se gestor pode gerenciar alvo | Interno (RLS) |
| `get_nivel_hierarquico(user_id)` | Retorna nível hierárquico (0=Fiscal, 1=Gerente, 2=Diretor, 3=Secretário) | Interno |
| `transferir_para_secretario_do_secretario(user_id)` | Promove servidor ao cargo de Secretário do Secretário | Secretário/Dev |

### Hierarquia de Exclusão:
```
Secretário(a) pode desativar: Todos (incluindo Diretores)
Diretor pode desativar: Gerentes, Fiscais, Equipe RA (exceto Secretários)
Gerente pode desativar: Fiscais e Equipe sob sua responsabilidade
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
- **Botões "+ Novo" por Nível**: Cadastro rápido de funcionários em cada nível hierárquico (Diretores, Gerentes, Fiscais, Equipe Ambiental, Consórcio, Analistas do Consórcio)
- **Desativação com Transferência**: Ícone de lixeira em cada card permite desativar funcionário com opção de transferir tarefas para outro

### Novos Dashboards na Sidebar
- **Visão Geral de Tarefas**: Cards com contadores de Pendentes, Em Progresso e Atrasadas + lista das 5 tarefas mais próximas
- **Controle Processual**: Gráfico doughnut mostrando distribuição de documentos por tipo nos últimos 30 dias (Notificações, Autos, Ofícios, etc)
- **Calendário de Projetos**: Mini-calendário mensal com dias destacados conforme eventos, lista dos 3 próximos eventos e navegação rápida para aba Projetos

### Gestão Hierárquica Completa
- Hierarquia visual: Secretário → Diretor → Gerente de Posturas/Fiscal de Posturas, Gerente RA/Fiscal de Meio Ambiente/Equipe Ambiental/Consórcio/Analistas
- Cores por cargo: Roxo (Diretor), Verde escuro (Ger. Posturas), Azul (Ger. RA), Laranja (Fiscal de Posturas), Azul claro (Fiscal de Meio Ambiente), Verde (Equipe), Âmbar (Consórcio), Âmbar claro (Analistas do Consórcio)
- Modal combinado para Fiscais: Estatísticas de tarefas + relatório de produtividade lado a lado

### Nova Hierarquia: Cuidado Animal
- **Diretor(a) do Cuidado Animal**: Dashboard com gestão de Gerentes e Coordenadores de CA
- **Gerente do Cuidado Animal**: Dashboard com gestão de Coordenadores de CA
- **Coordenador(a) do Cuidado Animal**: Acesso às tarefas atribuídas
- **Cores**: Rosa (`#db2777`) para Diretor, Rosa escuro (`#be185d`) para Gerente, Magenta (`#c026d3`) para Coordenador
- Menu expansível "Cuidado Animal" no sidebar do Diretor e Secretário
- Filtro de tarefas por modo `cuidado_animal`

### Cargos Especiais: Interface Jurídica e Administração
- **Novos Cargos**: "Gerente de Interface Jurídica", "Agente de Administração" e "Estagiário do Agente de Administração"
- **Home Exclusiva**: Layout em duas colunas (Tarefas de Eventos + Calendário de Projetos)
- **Permissões Restritas**: Apenas tarefas onde é responsável, atribuição somente para si mesmo
- **Sem Acesso**: Não podem criar projetos/eventos, não gerenciam equipes, não aparecem no ranking
- **Detecção por Normalização**: Sistema remove acentos automaticamente ("jurídica" → "juridica") para evitar conflitos de detecção
- **Menu Específico**: Sidebar simplificado com Home, Projetos (visualização) e Tarefas

## 🆕 Atualizações Recentes (Abril/2026)

### Módulo de Tarefas — Comentários, Notificações e Visualizações
- **Comentários em tarefas**: chat interno com suporte a múltiplos anexos por mensagem.
- **Notificações automáticas**: todos os responsáveis e o criador são notificados quando há novo comentário.
- **Visualizações**: indicador de "✓ Visualizou" com data/hora para tarefas e subtarefas.
- **Criador visível**: nome de quem criou a tarefa aparece no card do Kanban e no modal de detalhes.

### Regras de Edição, Exclusão e Anexos
- **Edição dentro de 24h**: apenas o criador pode editar sua própria tarefa ou subtarefa, e somente dentro de 24h após a criação. O modal de edição reutiliza o modal de criação, preenchendo todos os campos salvos (título, descrição, prazo, responsáveis) e permitindo adicionar novos anexos. Após o prazo, o botão de editar some automaticamente.
- **Exclusão dentro de 24h**: apenas o criador pode excluir sua própria tarefa, e somente dentro de 24h após a criação. Após esse prazo, o botão de excluir some automaticamente.
- **Sanitização de nomes de arquivo**: acentos e espaços são removidos/normalizados antes do upload para o Supabase Storage, corrigindo erros de `Invalid key`.
- **Status automático**: anexar um arquivo a uma tarefa pendente muda seu status automaticamente para **em_progresso**.
- **Reversão de subtarefa**: excluir o último anexo de uma subtarefa concluída reverte o status para **pendente**.

### Subtarefas e Permissões
- **Múltiplos responsáveis por subtarefa**: corrigido bug que limitava a um único responsável.
- **Descrição e anexo opcional**: ao criar uma subtarefa, é possível adicionar descrição e anexo já na criação.
- **Responsáveis alteram status**: quem é responsável pela tarefa pode alterar seu status (não só gerentes).

### Controle Processual e UI
- **Resposta NP/AI com data**: ao selecionar "ATENDIDO" em Notificação Preliminar ou Auto de Infração, um campo de data aparece pré-preenchido com o dia de hoje e é salvo como `ATENDIDO - dd/mm/aa`.
- **Filtro de tarefas no calendário**: o calendário de tarefas respeita os modos de visualização por cargo (Secretário/Diretor/Gerente) e exclui tarefas concluídas da visualização.
- **Cache GitHub Pages**: após atualizações no `tarefas.js` ou `painel.js`, usuários devem pressionar `Ctrl+F5` para carregar a versão mais recente.

### Categorias e Numeração Visual
- **Renumbering Seguro**: Implementado `obterIdVisual()` para exibir as categorias de Controle Processual como `16.1°` a `16.7°` e as atividades gerais como `1°` a `15°`, **sem alterar os IDs originais no banco de dados**.
- **Prefixo Padronizado**: Todas as categorias de Controle Processual agora exibem o prefixo `"Controle Processual: "` nos relatórios e históricos.

### Sidebar Responsiva e Fixa
- **Largura Proporcional**: A sidebar agora usa `clamp(200px, 20vw, 280px)`, garantindo que:
  - **Nunca seja comprimida** pelo conteúdo das páginas (`flex-shrink: 0`).
  - **Se adapte proporcionalmente** ao redimensionamento da janela do navegador.
- **Histórico Geral Otimizado**: Zoom reduzido em ~15% (`zoom: 0.85`) e a barra de rolagem horizontal das tabelas de Controle Processual foi reposicionada para a **parte superior** (acima do cabeçalho), facilitando a navegação.

### Gráficos e Relatórios do Fiscal (Painel do Gerente)
- **Correção do PDF do Relatório Fiscal**: A exportação de PDF pelo superior (Gerente/Diretor/Secretário) foi corrigida. A função `salvarPDFGerente()` em `gerente.js` agora utiliza `window.print()` com CSS `@media print` dedicado, gerando corretamente **todas as páginas** do relatório (antes gerava apenas a primeira página via `html2pdf.js`).
- **Proteção Contra Duplo Clique**: Ao abrir o relatório de um fiscal no painel de gestão, um overlay de "Carregando..." com spinner aparece e **bloqueia cliques adicionais** até que o modal esteja totalmente renderizado.
- **Botão Fechar (X) no Modal**: Adicionado botão fixo no canto superior direito do modal do relatório fiscal, e corrigido o fechamento ao clicar fora da área do conteúdo em telas reduzidas.
- **Toggle Mês/Ano no Gráfico**: Adicionados botões "Mês" e "Ano" no gráfico de pizza do relatório fiscal:
  - **Mês**: exibe todas as categorias do relatório (produtividade + CP com pontos > 0).
  - **Ano**: exibe todos os registros de CP do ano atual (incluindo pontuação zerada).
- **Layout Responsivo do Modal**: Em telas entre 580px e 900px, os gráficos ficam lado a lado no topo e o relatório abaixo. Em telas menores que 580px, os gráficos empilham verticalmente.
- **Legenda do Gráfico "Controle Processual"**: A legenda do gráfico doughnut no painel do Gerente foi movida da direita para **embaixo do gráfico**.
- **Interatividade no Gráfico de Status das Tarefas**: Ao clicar em uma fatia do gráfico doughnut de status (Concluídas, Em Progresso, Pendentes, Atrasadas) no relatório do fiscal, aparece uma lista filtrada com as tarefas daquele status. Clicar em uma tarefa da lista abre o modal completo de detalhes da tarefa (`abrirDetalheTarefa`).

### Performance dos Gráficos de Gestão
- **Evitado Limite de 1000 Linhas**: As funções `carregarGraficoDocumentos()` e `carregarGraficoDocumentosSecretario()` em `gerente.js` passaram a usar consultas `count(*)` por categoria (`head: true`) ao invés de buscar todas as linhas, evitando inconsistências quando o `controle_processual` ultrapassa 1000 registros.

### Correções de Estabilidade
- **Limpeza de Syntax**: Removidos caracteres literais `\n` acidentalmente injetados nos arquivos JS durante substituições automatizadas anteriores, que estavam quebrando gráficos e funcionalidades de histórico.

---

## 🆕 Atualizações Recentes (22/04/2026)

### Relatório de Produtividade do Fiscal no Modal de Estatísticas (Visão do Secretário)
- **Disponibilidade exclusiva para Secretário(a)**: ao clicar em um **Fiscal de Posturas** ou **Fiscal de Meio Ambiente** na hierarquia visual, o modal de estatísticas (`abrirEstatisticasFuncionario`) agora carrega automaticamente o **Relatório de Produtividade** completo do fiscal logo abaixo das seções de Tarefas e Eventos.
  - Reutiliza a mesma lógica de dados do relatório fiscal do Gerente (`abrirRelatorioFiscal`), mas renderizado inline dentro do modal de estatísticas.
  - Correção de detecção de cargo: a verificação passou a usar corretamente `window.userRoleGlobal` (antes usava `window.userProfile`, inexistente no projeto).

### Tabela de Registros Aprimorada
- **Bordas visíveis**: todas as células (`th` e `td`) agora possuem bordas sólidas (`#cbd5e1`) separando linhas e colunas.
- **Espaçamento**: padding aumentado para `10px 12px` em todas as células, eliminando o "grudamento" entre pontuação e data.
- **Coluna "Anexo"**: nova coluna que detecta automaticamente campos do tipo `file`, o array `anexos_extras` e as chaves `anexo_pdf` / `anexo_ar` do JSONB `campos` de cada registro.
  - Sem anexo: exibe `-`.
  - 1 anexo: botão azul `📎 Abrir` que abre o documento em nova aba.
  - Múltiplos anexos: botões numerados (`1`, `2`, `3`...) cada um abrindo seu respectivo documento.
  - **Filtro de duplicatas**: URLs repetidas são automaticamente removidas, evitando botões duplicados em categorias onde o anexo já é definido como campo `file` (ex: Notificação Preliminar, Protocolo).

### Exportação PDF do Relatório Fiscal (dentro do Modal de Estatísticas)
- **Botão "Salvar como PDF"**: adicionado ao final da seção do relatório, com estilo idêntico ao do painel do Gerente (`#0f172a`, bordas arredondadas, emoji 💾).
- **Impressão via iframe isolado**: a função `salvarPDFEstatisticasFiscal()` cria um iframe invisível, clona apenas o conteúdo do relatório e imprime de forma isolada. Isso evita conflitos com o CSS global `@media print` do site, que antes escondia o modal e gerava página em branco.
- **Paginação corrigida**: o conteúdo flui naturalmente por múltiplas páginas. Removido `page-break-inside: avoid` excessivo em divs que causava grandes espaços em branco entre páginas. Mantido apenas `page-break-inside: avoid` nas linhas de tabela (`tr`) para não cortar uma linha ao meio.
- **Gráfico excluído do PDF**: o container do gráfico de pizza (botões Mês/Ano, canvas e espaço reservado de 380px) é removido completamente do clone antes da impressão, garantindo que o PDF contenha apenas as tabelas de registros.

### Correções de Anexos no Relatório de Produtividade (Modal de Estatísticas)
- **Documentos WYSIWYG**: categorias geradoras de documentos oficiais via editor (`Auto de Infração`, `Ofício`, `Relatório`, `Réplica`) passaram a exibir corretamente o botão de anexo no relatório do fiscal. O sistema agora lê a chave `anexo_pdf` do JSONB `campos`, já que essas categorias não possuem campo `file` na definição da categoria.
- **Aviso de Recebimento (AR)**: também é detectado via chave `anexo_ar`.
- **Remoção de duplicatas**: implementado filtro por URL única no array de anexos antes da renderização, corrigindo o problema de botões duplicados em categorias como **Notificação Preliminar** e **Protocolo**, onde o campo `anexo_pdf` já está definido como `file` na categoria e também existe no JSONB `campos`.

### UX do Modal de Estatísticas
- **Clique fora fecha**: o modal agora fecha ao clicar no overlay escuro (`onclick` no fundo do modal), comportamento padrão dos demais modais do sistema.

---

## 🆕 Atualizações Recentes (24/04/2026)

### Fluxo de Rascunho para Documentos Oficiais WYSIWYG
Implementado sistema de **rascunho com reserva de número** para as categorias geradoras de documentos oficiais, eliminando race conditions e garantindo integridade sequencial:

**Categorias afetadas:**
- **1.2° (16.2°) Auto de Infração**
- **1.4° (16.4°) Ofício**
- **1.5° (16.5°) Relatório**
- **1.7° (16.7°) Réplica**
- **11° Montagem de processo para encaminhamento, exclusivamente para inscrição em dívida ativa**

**Como funciona o novo fluxo:**
1. **Ao clicar em "Gerar Documento"**: o sistema gera o número sequencial **online** e imediatamente cria um registro na tabela `controle_processual` com:
   - `pontuacao: 0` (ainda não conta pontos)
   - Sem anexo
   - Número sequencial já reservado
2. **Ao clicar em "Baixar Word (.doc)"**: o documento `.doc` é baixado, o PDF é gerado em background e o sistema **atualiza o rascunho existente** com o anexo PDF e a pontuação correta.
3. **Se cancelar antes de baixar**: ao clicar em "Voltar ao Formulário" ou no X do editor, aparece uma confirmação; se o usuário confirmar, o rascunho é **excluído automaticamente** do banco e o número é liberado.

**Novas funções em `produtividade.js`:**
- `criarRascunhoControleProcessual()` — cria o registro temporário no banco.
- `finalizarDocumentoComAnexo()` — faz upload do PDF e atualiza pontuação.
- `cancelarRascunhoDocumento()` — remove o registro temporário.
- `abrirEditorDividaAtiva()` — nova função que transformou a categoria 11 de "Gerar Número" direto para editor WYSIWYG completo, no mesmo padrão das demais categorias de documento.

### Ofício (1.4° / 16.4°) — Rascunho + Fila Global de Reutilização
A categoria **Ofício** agora também utiliza o fluxo de rascunho WYSIWYG, com mecanismos adicionais para garantir **sequencialidade perfeita** e **reutilização de números cancelados**:

- **Fila global no banco**: ao cancelar um Ofício antes de baixar o Word, o número é devolvido para a tabela `numeros_disponiveis` no Supabase via função RPC `devolver_numero_sequencial()`. Qualquer usuário, em qualquer computador, pode reutilizar esse número.
- **Reutilização automática**: na próxima geração, a função RPC `reservar_numero_sequencial()` verifica primeiro a fila global. Se houver números pendentes, reutiliza **sempre o menor** (ordenado numericamente). Só gera um número novo quando a fila está vazia.

### Numeração Sequencial Robusta (via RPC Atômica)
A função `gerarNumeroSequencial()` em `produtividade.js` foi refatorada para usar **funções RPC no PostgreSQL**, resolvendo definitivamente os 3 principais pontos de falha:

1. **Limite de 1000 linhas do Supabase**: eliminado. A RPC calcula o próximo número diretamente no banco via `MAX(split_part(..., '/', 1)::integer)`, sem trazer registros para o cliente.
2. **Legado sem Padding**: eliminado. A ordenação é puramente numérica (`::integer`), então registros antigos como `"5/2026"` ou `"005/2026"` são tratados corretamente.
3. **Race Condition**: eliminada. A função RPC `reservar_numero_sequencial()` é atômica no PostgreSQL. Ela usa `FOR UPDATE SKIP LOCKED` na fila e o cálculo de `MAX` ocorre dentro da mesma transação, garantindo que dois usuários nunca recebam o mesmo número.
4. **Desempenho**: otimizado. Zero transferência de dados desnecessária — apenas o número final é retornado ao cliente.

**Novas funções RPC (adicionar ao Supabase via SQL Editor):**
- `reservar_numero_sequencial(p_categoria_id, p_ano)` → retorna o próximo número único (da fila ou calculado).
- `devolver_numero_sequencial(p_numero, p_categoria_id, p_ano)` → devolve um número cancelado para a fila global.

> 📋 O SQL completo está documentado na seção **"Tabela e Funções RPC para Fila de Números Sequenciais"** do arquivo `PERMISSOES_SETUP.md`.

### Correções de Sincronização em Tempo Real (Produtividade)
Corrigidos **3 bugs críticos** onde a pontuação total, o gráfico de produtividade e o badge "Meta 2000" não atualizavam automaticamente após certas operações, forçando o usuário a recarregar a página (F5):

1. **Documentos WYSIWYG (Baixar Word)**: ao finalizar o download de um documento oficial (Auto de Infração, Ofício, Relatório, Réplica, Dívida Ativa), o sistema atualizava o banco com o anexo e a pontuação, mas não recarregava o histórico na interface. A pontuação só aparecia após F5.  
   → `baixarDocumentoWord()` agora chama `carregarHistorico()` após salvar, atualizando todos os cards e o gráfico instantaneamente.

2. **Edição no Histórico Geral**: ao salvar alterações em um registro pelo Histórico Geral (ex: resposta do fiscal, datas, anexos), a tabela do histórico geral era re-renderizada, mas a pontuação total pessoal permanecia desatualizada.  
   → `salvarDetalhesHist()` agora chama `carregarHistorico()` após salvar.

3. **Exclusão no Histórico Geral**: ao excluir um registro pelo Histórico Geral, ele sumia da tabela, mas os cards de pontuação e o gráfico continuavam com os valores antigos.  
   → `excluirRegistroHistGeral()` agora chama `carregarHistorico()` após excluir.

**O que `carregarHistorico()` atualiza em tempo real:**
- Cards de pontuação (Home, Histórico e Produtividade)
- Total de registros
- Gráfico de produtividade por dia (Chart.js)
- Badge "🏆 META ATINGIDA" quando a soma atinge 2000 pontos

---

## 🆕 Atualizações Recentes (24/04/2026) — Edição de Tarefas e Subtarefas

### Edição de Tarefas
- **Disponibilidade**: botão "Editar Tarefa" visível no modal de detalhes exclusivamente para o **criador** da tarefa e **somente dentro de 24h** após a criação (mesma regra da exclusão).
- **Modal reutilizado**: ao clicar em editar, o sistema fecha o modal de detalhes e abre o modal de "Nova Tarefa" preenchido com todos os dados salvos:
  - Título, descrição e prazo preenchidos automaticamente.
  - Responsáveis já marcados nos checkboxes.
  - Permite alterar qualquer campo e adicionar novos anexos.
- **Título e botão adaptativos**: em modo edição, o modal exibe **"Editando Tarefa"** e o botão de ação exibe **"Salvar Alterações"**.
- **Persistência**: ao salvar, o sistema executa `UPDATE` na tabela `tarefas`, remove os responsáveis antigos em `tarefa_responsaveis`, insere os novos, faz upload de novos anexos e mantém intactos o `status`, `criado_por`, `evento_id` e `created_at`.
- **Funções alteradas em `tarefas.js`**: `abrirModalNovaTarefa()` (novo parâmetro `editarTarefaId`), `salvarTarefa()` (suporte a update), `carregarListaResponsaveis()` / `renderizarListaResponsaveisComPesquisa()` (pré-seleção), `carregarDadosTarefaParaEdicao()` (nova), `editarTarefaExistente()` (nova).

### Edição de Subtarefas
- **Disponibilidade**: botão "Editar Subtarefa" (ícone ✎) visível ao lado do botão de excluir em cada subtarefa, exclusivamente para o **criador** da subtarefa e **somente dentro de 24h** após a criação.
- **Modal reutilizado**: o modal de "Nova Subtarefa" é aberto preenchido com os dados da subtarefa:
  - Título e descrição preenchidos automaticamente.
  - Responsáveis já marcados nos checkboxes.
  - Permite adicionar um novo anexo (o anexo anterior é preservado).
- **Título e botão adaptativos**: em modo edição, o modal exibe **"Editando Subtarefa"** e o botão exibe **"Salvar"**.
- **Persistência**: ao salvar, o sistema executa `UPDATE` na tabela `tarefas`, sincroniza os responsáveis em `tarefa_responsaveis`, faz upload de novo anexo se houver e mantém intactos o `status`, `criado_por`, `tarefa_pai_id` e `created_at`.
- **Funções alteradas em `tarefas.js`**: `abrirCriarSubtarefa()` (novo parâmetro `editarSubtarefaId`), `confirmarSubtarefa()` (suporte a update), `carregarListaResponsaveisSubtarefa()` / `renderizarListaResponsaveisSubComPesquisa()` (pré-seleção), `carregarDadosSubtarefaParaEdicao()` (nova), `editarSubtarefaExistente()` (nova).

## 🆕 Atualizações Recentes (25/04/2026) — Árvore Hierárquica do Secretário

### Consórcio e Analistas do Consórcio na Hierarquia Visual
- **Consórcio** adicionado como nova coluna dentro da **Gerência Ambiental**, ao lado da Equipe RA.
- **Analistas do Consórcio** aparecem como subnível abaixo do Consórcio (igual aos Fiscais abaixo dos Gerentes de Posturas).
- **Linha horizontal azul** (`#1e3a5f`) conecta a Gerência Ambiental às duas colunas internas (Equipe RA + Consórcio).
- **Cores**:
  - Consórcio: `#d97706` (âmbar)
  - Analistas do Consórcio: `#f59e0b` (âmbar claro)
- **Dropdown "+ Novo"** para Equipe RA com opções: Eng. Agrônomo, Eng. Civil, Analista Ambiental, Auxiliar.
- **Botão "+ Novo"** separado para Consórcio e para Analista do Consórcio.

### Correção de Estrutura HTML (Divs Mal Fechadas)
- Corrigido bug crítico na `carregarHierarquiaCompletaSecretario()` onde o **wrapper interno do Diretor MA** e o **flex de GP+GA** não eram fechados.
- Esse bug fazia o Diretor MA "engolir" o Diretor CA e os Cargos Especiais, quebrando o layout inteiro da árvore.
- Após a correção, cada nível da hierarquia fecha suas próprias tags corretamente.

### Ajustes de Espaçamento e Layout
| Elemento | Valor Anterior | Valor Atual |
|----------|---------------|-------------|
| Gap entre Diretor MA e Diretor CA | 10px | **60px** |
| Gap entre Gerência Posturas e Gerência Ambiental | 45px | **65px** |
| Largura coluna Gerência Posturas (GP) | 220px | **290px** |
| Largura coluna Equipe RA | 270px | **210px** |
| Largura coluna Consórcio | 140px | **130px** |

- **Fiscais**: permanecem em grid de **2 colunas**, com cada card aproveitando a nova largura da GP (~142px por card).
- **Consórcio**: permanece em **1 coluna** (fila), alinhado com a linha horizontal azul.

### Linha Horizontal Azul Estendida
- A linha que conecta a Gerência Ambiental às colunas internas (Equipe + Consórcio) agora se estende:
  - **10px para a esquerda**
  - **30px para a direita**
- Implementado com `width: calc(100% + 40px)` e `margin-left: -10px`, sem quebrar o container pai.

### Comportamento Responsivo (Wrap)
- O nível 2 (Diretores) voltou a usar **`flex-wrap: wrap`**.
- Em telas grandes: Diretor MA e Diretor CA ficam **lado a lado**.
- Em telas pequenas: Diretor CA **desce sozinho** para a linha de baixo, permanecendo centralizado.
- O Diretor MA permanece centralizado em cima, independente do wrap.

### Regras de Tarefas para Consórcio
- **Gerente de Regularização Ambiental** pode atribuir tarefas ao Consórcio (mas não aos Analistas do Consórcio diretamente).
- **Consórcio** pode criar tarefas, visualizar tarefas, atribuir tarefas aos Analistas do Consórcio e criar subtarefas em suas próprias tarefas.
- **Detecção por normalização**: todas as verificações de cargo usam `.normalize('NFD').replace(/[\u0300-\u036f]/g, '')` para garantir compatibilidade com "Consórcio" acentuado no banco de dados.

### Correção de Data Inválida em Tarefas
- `formatarDataBRTarefa()` agora extrai `substring(0, 10)` antes de converter a string em `Date`, evitando o erro `"Invalid Date"` em campos de prazo.

### Reorganização de Pastas do Projeto
O projeto foi completamente reorganizado em pastas específicas para melhor manutenibilidade e clareza:

**Nova estrutura:**
```
SEMAC/
├── index.html, painel.html, redefinir-senha.html   ← entry points (raiz)
├── lib/                                              ← bibliotecas de terceiros (inalterado)
├── assets/
│   ├── css/     ← style.css, style_painel.css, style_produtividade.css
│   ├── js/      ← script.js, protecao.js, painel.js, produtividade.js,
│   │              gerente.js, tarefas.js, projetos.js, fechamento.js,
│   │              cabecalho_img.js
│   └── img/     ← logoSemac.png, Cabeçalho.png, raminho.png, folhas.jpg
└── README.md, PERMISSOES_SETUP.md
```

**Mudanças aplicadas:**
- Todos os arquivos CSS movidos para `assets/css/`
- Todos os arquivos JS próprios movidos para `assets/js/`
- Todas as imagens movidas para `assets/img/`
- A pasta `lib/` permaneceu na raiz para evitar quebra de múltiplas importações nos HTMLs
- Todas as referências em `index.html`, `painel.html`, `style.css`, `painel.js` e `produtividade.js` foram atualizadas para refletir os novos caminhos
- Os entry points (`index.html`, `painel.html`, `redefinir-senha.html`) e as navegações por `window.location.href` permanecem inalterados na raiz

---

## 🆕 Atualizações Recentes (06/05/2026) — Home do Diretor e Responsividade

### 🏠 Cards de Funcionários na Home do Diretor
- **Correção de layout desktop**: Resolvido problema de texto verticalizado/cortado nos cards de gerentes e consórcios.
- **Grid responsiva adaptativa**:
  - **Desktop (> 1100px)**: `repeat(auto-fit, minmax(800px, 1fr))` — colunas largas e confortáveis.
  - **Tablet/Sidebar visível (769px ~ 1100px)**: cai para `1fr` (coluna única) para evitar corte lateral quando a sidebar ocupa espaço.
  - **Mobile (≤ 768px)**: `1fr` com layout vertical mantido.
- **Flex interno otimizado**: Container de texto usa `flex: 1` para ocupar todo o espaço restante; gap reduzido para `12px`; avatar e botão mantêm tamanhos fixos.
- **Tipografia ajustada**: Nome em `14px`, matrícula/e-mail em `12px` — legível sem desperdiçar espaço.
- **Fotos**: `aspect-ratio: 1` + `object-fit: cover` garantem proporção quadrada sem distorção.

### 📊 Relatório de Produtividade e Limpeza Geral (Fiscal de Posturas / Fiscal de Meio Ambiente)
- **Filtro por mês no relatório**: O relatório agora exibe **apenas os registros do mês referente**, determinado pela regra dos 7 dias (até dia 7 = mês anterior; após dia 7 = mês atual). Registros de outros meses são omitidos automaticamente.
- **Limpeza Geral inteligente**: O botão "Limpeza Geral" agora afeta **apenas registros de meses anteriores**, mantendo intocados todos os registros do **mês atual** (sem aplicar a regra dos 7 dias).
  - **Controle Processual**: zera a pontuação (`pontuacao = 0`) apenas dos registros com `created_at` de meses passados.
  - **Produtividade Normal**: exclui permanentemente apenas os registros com `created_at` de meses passados.
  - O fiscal é informado por mensagem qual mês está sendo protegido antes de confirmar a limpeza.

---

## 🆕 Atualizações Recentes (29/04/2026) — Padronização e Eventos

### 🚀 Módulo de Eventos e Projetos (Separação Visual)
- **Segregação de Listas**: A aba "Eventos e Projetos" agora possui containers independentes para **Eventos** e **Projetos**. Ambos compartilham o mesmo calendário, mas são listados separadamente para melhor organização.
- **Filtros Dinâmicos por Botões**: Substituição do seletor de tipo por botões de filtro rápido (**Tudo**, **Eventos**, **Projetos**) acima do calendário. O filtro afeta tanto os indicadores no calendário quanto as listas de cards.
- **Campo "Tipo" na Criação**: Adicionado seletor de tipo (Evento vs Projeto) nos modais de criação e edição. 
  - *Nota técnica*: Requer a coluna `tipo` (text) na tabela `eventos` do Supabase.

### 📋 Padronização de Interface e Nomenclatura
- **Botões de Ação**: O botão "+ Novo Evento" foi simplificado para **"+ Novo"**, seguindo a tendência de design minimalista.
- **Home do Diretor**: O widget "Tarefas de Eventos" agora se chama apenas **"Tarefas"** e inclui automaticamente as tarefas de todos os seus **subordinados** (Gerentes e equipes), permitindo uma visão gerencial completa.
- **Home do Secretário**: 
  - Widget renomeado para **"Eventos e Projetos"**.
  - Visibilidade expandida: agora exibe **todos** os eventos e projetos do sistema, ignorando filtros de modo (como Jurídico/RH) para garantir visão total à gestão municipal.

### ⚙️ Lógica e Segurança
- **Filtro de Hierarquia**: A função `carregarMinhasTarefasHome` foi aprimorada para detectar o cargo de Diretor e concatenar IDs de gerentes e fiscais na busca de tarefas.
- **Persistência de Filtro**: Uso de inputs ocultos para manter o estado do filtro de tipo entre recarregamentos de dados.

### 💬 Respostas em Subtarefas
- **Campo de Resposta**: Adicionada a opção de inserir uma resposta textual diretamente nas subtarefas, permitindo que o responsável relate o andamento sem a necessidade de anexar um arquivo.
- **Rastreabilidade**: O sistema agora registra automaticamente **quem** enviou a resposta e **em qual data/hora**, exibindo essa atribuição logo abaixo do texto.
- **Flexibilização da Conclusão**: A regra de conclusão foi alterada para aceitar **Anexo OU Resposta**. Subtarefas agora podem ser finalizadas se houver pelo menos uma dessas informações registradas.
- **Visualização Estilizada**: Respostas salvas são exibidas em um card destacado (verde claro) com identificação visual, facilitando o acompanhamento por outros membros da equipe.

### 🤖 Automação de Produtividade (Notificação Preliminar)
- **Registro Automático de Atendimento**: Ao editar uma Notificação Preliminar no Histórico Geral e alterar a resposta para "ATENDIDO" (via select ou texto), o sistema agora identifica automaticamente a mudança.
- **Pontuação Garantida**: Insere instantaneamente 20 pontos referentes à categoria "Notificação Preliminar regularizados (atendidos)" para o fiscal responsável, evitando retrabalho e agilizando a prestação de contas.
- **Feedback Padronizado**: O alerta de sucesso foi ajustado para detalhar a pontuação incluída, seguindo o mesmo padrão visual de lista (`•`) utilizado na geração original dos documentos.

---
### 🤖 Atualizações Recentes (05/05/2026) - Automação de Produtividade (Notificação Preliminar); Automação de Busca de Bairros.

- **Registro Automático de Atendimento**: Ao editar uma Notificação Preliminar no Histórico Geral e alterar a resposta para "ATENDIDO" (via select ou texto), o sistema agora identifica automaticamente a mudança.
- **Pontuação Garantida**: Insere instantaneamente 20 pontos referentes à categoria "Notificação Preliminar regularizados (atendidos)" para o fiscal responsável, evitando retrabalho e agilizando a prestação de contas.
- **Feedback Padronizado**: O alerta de sucesso foi ajustado para detalhar a pontuação incluída, seguindo o mesmo padrão visual de lista (`•`) utilizado na geração original dos documentos.
>>>>>>> meus-ajustes-salvos

## 🆕 Atualizações Recentes (06/05/2026) — Datas no Relatório, Limpeza e Pontuação; 

### 📅 Lógica de Datas Separada (CP vs Registros Comuns)
- **`obterDataReal()`**: Função unificada de extração de data agora diferencia automaticamente:
  - **Controle Processual** (`categoria_id` começando com `1.`): sempre utiliza `created_at` (data de entrada no sistema).
  - **Registros comuns** (`registros_produtividade`): busca o campo `data` dentro do JSON `campos` (formatos ISO `YYYY-MM-DD`, brasileiro `DD/MM/YYYY` ou curto `DD/MM/YY`).
- **Fallback seguro**: Se não encontrar uma data válida nos campos, retorna `created_at` para garantir que nenhum registro fique sem data.

### 📊 Filtro do Relatório por Data Real
- O relatório de produtividade agora filtra registros comuns **pela data informada no formulário** (`campos.data`), não mais pelo `created_at`.
- **Exemplo prático**: Um fiscal pode salvar hoje (05/05) um registro com data retroativa (01/04) e ele aparecerá corretamente no relatório de **abril**, não de maio.
- **Controle Processual continua usando `created_at`** para o filtro de mês, preservando o comportamento processual.

### 🧹 Limpeza Geral Inteligente por Data Real
- O botão "Limpeza Geral" agora também usa a **data do campo** (`campos.data`) para avaliar registros comuns:
  - **Controle Processual**: mantém o uso de `created_at` para zerar pontuação de meses anteriores.
  - **Registros comuns**: busca todos os registros do usuário, extrai a data real via `obterDataReal()`, e exclui apenas aqueles cujo mês/ano é **estritamente anterior** ao mês atual.
- Isso evita que registros salvos "em atraso" (ex: digitados no dia 05/05 com data 30/04) sejam erroneamente mantidos ou apagados.

### ⚡ Atualização Automática da Pontuação após Salvar
- Ao salvar um **novo registro** (fluxo de criação), a função `carregarHistorico()` é chamada automaticamente após fechar o modal.
- A pontuação total exibida na Home e no resumo é atualizada **instantaneamente**, sem necessidade de recarregar a página.
- O fluxo de **edição** já mantinha esse comportamento (fecha modal, exibe toast de sucesso e recarrega).

### 🖊️ UX de Edição e Salvamento (Ajustes Finais)
- **Botão Salvar**: exibe "Carregando..." imediatamente ao iniciar o salvamento, com timeout de conexão reduzido para 2000ms.
- **Modal de Edição**: fecha instantaneamente ao confirmar, exibe toast "Alteração salva" e rola suavemente até a seção de histórico.
- **Anexos preservados**: em modo de edição, inputs do tipo `file` são ocultados e os campos existentes são mantidos via spread operator (`{ ...registroSelecionado.campos }`).


### 🏙️ Integração com Banco de Dados de Bairros
- **Campo Inteligente**: Os campos de "Bairro" nos formulários (ex: Notificação Preliminar, Auto de Infração, Protocolo, etc.) foram transformados de inputs de texto livre para campos de seleção interativos (`select_bairro`).
- **Busca em Tempo Real**: Adicionado filtro de pesquisa integrado ao dropdown, permitindo localizar rapidamente o bairro desejado na lista.
- **Carregamento Automático**: O sistema agora puxa automaticamente os bairros mapeados na tabela oficial `bairros` do Supabase assim que a aplicação é iniciada.
- **Aviso Dinâmico**: Caso o fiscal não encontre o bairro na lista, um alerta integrado aparece instruindo-o a notificar o Gerente de Posturas para cadastro, garantindo consistência na base de dados.
- **Integração com Auto-Preenchimento (Word)**: A automação de extração de dados de arquivos DOCX foi atualizada para suportar o novo componente dropdown, atualizando visualmente o bairro extraído do documento Word na tela.

## 🆕 Atualizações Recentes (08/05/2026) — Botões Vencidos/Atendidos no Histórico Geral

### 🔴🟢 Botões Vencidos e Atendidos (GP+)
- **Visibilidade**: Dois botões aparecem abaixo do "Fechamento Anual" no Histórico Geral, exclusivamente para cargos de **Gerente de Posturas (GP) ou superior** (Diretor, Secretário).
- **Aba NP (1.1)**: botões filtram Notificações Preliminares.
- **Aba AI (1.2)**: botões filtram Autos de Infração.
- **Fora dessas abas**: botões ficam ocultos automaticamente.

#### Botão "Vencidos"
- Lista registros com **data de vencimento já passada** e **sem resposta do fiscal**.
- Exibe a **quantidade total** em badge vermelho.
- Tabela com colunas: N°, Nome, Bairro, Fiscal, Data Venc., Resposta, Anexos.

#### Botão "Atendidos"
- Lista registros cuja **resposta do fiscal contém "ATENDIDO"**.
- Exibe a **quantidade total** em badge verde.
- Mesmas colunas do modal de vencidos.

#### Download de Relatório
- Cada modal possui dropdown **"Baixar Relatório"** com duas opções:
  1. **Somente Relatório** → abre HTML formatado em iframe para impressão/PDF.
  2. **Relatório + Anexos (ZIP)** → gera ZIP contendo relatório HTML + todos os anexos (PDF/AR/extras) organizados na pasta `anexos/`.

---

### 🔗 Separação Inteligente: NP Vencidas com AI Vinculado
- Ao abrir "Vencidos" na aba **NP**, o sistema busca automaticamente no banco todos os **Autos de Infração** (categoria 1.2) cujo campo `Nº da notificação` (`campos.n_notificacao`) corresponda ao número de alguma NP vencida.
- O modal é dividido em **duas seções**:
  - **⚠️ Vencidas com Auto de Infração vinculado** (fundo amarelo) — NPs que já possuem AI gerado, mas o fiscal ainda não marcou a resposta no sistema.
  - **🔴 Vencidas sem Auto de Infração** (fundo vermelho claro) — NPs que realmente não têm AI vinculado.
- **Coluna "AI Vinculado"**: mostra o número do AI (badge âmbar) e botão 📎 para abrir o anexo PDF do AI diretamente.

---

### 🔄 Ordenação no Modal de Vencidos
- Dropdown **"Ordenar por..."** disponível em **ambos os modais** de Vencidos (NP e AI).
- Opções de ordenação (todas com direção reversa):
  - **Data Venc. (próxima → distante)** / **(distante → próxima)**
  - **Fiscal (A → Z)** / **(Z → A)**
  - **Bairro (A → Z)** / **(Z → A)**
  - **Nome (A → Z)** / **(Z → A)**
- A ordenação é aplicada **instantaneamente** sem fechar o modal.
- O **relatório e o ZIP** respeitam a ordem escolhida pelo usuário.

---

### 🐛 Correção do Gráfico de Status do Fiscal
- No Histórico Geral, ao filtrar por nome de fiscal, o gráfico de barras **"Status das Pendências do Fiscal"** agora conta cada categoria de forma **independente**.
- Antes, o uso de `else if` fazia registros com múltiplos status (ex: Atendido + Com Histórico) serem contados apenas na primeira categoria.
- Agora um registro pode incrementar **uma, duas ou três barras simultaneamente**, refletindo a real situação das pendências.
- Delay de renderização do Chart.js aumentado de 50ms para 150ms para maior estabilidade visual.

## 🛡️ Atualizações Recentes (13/05/2026) — Sistema de Prevenção de Duplicidade

### 🚫 Bloqueio Inteligente de Registros Duplicados
- **Validação Global e em Tempo Real**: Implementação de uma camada de segurança na função `salvarRegistro` que consulta o histórico do banco de dados antes de permitir a inserção de novos dados.
- **Integridade por Categoria**: O sistema agora identifica automaticamente a regra de unicidade específica para cada tipo de serviço, impedindo lançamentos repetidos que gerariam pontuação indevida.
- **Feedback Imediato com SweetAlert2**: Caso uma duplicidade seja detectada, o sistema interrompe o salvamento e exibe um alerta vermelho detalhando o motivo do bloqueio (ex: Protocolo já existente, Turno já ocupado, ou Data já registrada).

### 📋 Regras de Unicidade Aplicadas
| Categorias | Critério de Bloqueio (O que não pode repetir) |
| :--- | :--- |
| **1°, 2° e 3°** | **N° de Protocolo** (Unicidade global por categoria) |
| **4°, 28°, 29° e 30°** | **Data e Duração** (Evita duplicar horas no mesmo dia) |
| **5° (Serv. Extraordinário)** | **Responsável + Data + Turno** (Diurno/Noturno) |
| **6° (Certidão/Relatório)** | **Tipo de Documento + N° de Descrição** |
| **7° (Ofícios)** | **N° do Ofício** |
| **8°, 9°, 11° e 12°** | **N° do Processo** |
| **13° e 14° (Notificações)** | **N° da Notificação** |
| **15° (Autos)** | **N° do Auto de Infração** |
| **17°, 18°, 20°, 21° e 22°** | **Local/Endereço + Data** |
| **23° (Apreensões)** | **Local + Espécie de Mercadoria + Data** |
| **24° e 25° (Interdições)** | **Nome do Estabelecimento + Data** |
| **26° e 27° (Alvarás/Licenças)** | **N° do Documento + Data** |

### 🔧 Inteligência de Edição
- **Modo Edição Preservado**: O sistema detecta automaticamente quando o usuário está apenas corrigindo um registro existente (`modoEdicao`), permitindo o salvamento sem disparar o bloqueio de duplicidade contra o próprio registro.
- **Tratamento de Texto**: Implementação de normalização (`trim` e `toLowerCase`) para garantir que espaços extras ou variações entre maiúsculas e minúsculas não burlem a segurança.

## 🆕 Atualizações Recentes (12/05/2026) — Fiscais de Posturas, Filtro de Bairros, Áreas com Demanda e Scroll Mirror

### 🔴🟢 Botões Vencidos e Atendidos agora disponíveis para Fiscais de Posturas
- **Antes**: os botões "Vencidos" e "Atendidos" no Histórico Geral eram visíveis apenas para **Gerente de Posturas (GP) ou superior**.
- **Agora**: **Fiscais de Posturas** também visualizam os botões nas abas NP (1.1) e AI (1.2).
- **Filtro por fiscal**: para Fiscais de Posturas, os modais mostram **apenas os registros atribuídos a ele** (comparação por `fiscal_nome === nome do usuário logado`).
- GP+ continuam vendo todos os registros sem restrição.

---

### 🏘️ Filtro por Bairro no Histórico Geral — Mais Inteligente
- O filtro de bairro foi **movido do banco (Supabase) para o cliente (JavaScript)**, permitindo comparações mais flexíveis.
- **Ignora maiúsculas/minúsculas**: "centro" encontra "Centro".
- **Ignora acentos**: "Sao Joao" encontra "São João".
- **Ignora a palavra "Bairro" no início**: "Centro" encontra "Bairro Centro" e vice-versa.
- Aplica-se também na reclassificação inteligente de NP → AI.

---

### 📊 Áreas com Maior Demanda (aba Bairros)
- Nova lista exibida **ao lado do gráfico "Peso por Bairro (Top 10)"** na aba Bairros.
- Calcula a demanda total (NP + AI + Denúncias dos últimos 30 dias) de cada **Área** somando seus bairros vinculados.
- Exibe o **Top 10** áreas com ranking numerado, barra de progresso visual e total de demandas.
- Se houver **mais de 10 áreas com demanda**, aparece o botão **"Ver todos"** para expandir a lista completa.

---

### 🔧 Correção de Erro de Lock no Carregamento da aba Bairros
- Resolvido erro `"AbortError: Lock broken by another request with the 'steal' option"` do IndexedDB/Supabase.
- Causa: `carregarGraficoBairros()` e `carregarGestaoBairrosAreas()` eram chamadas **em paralelo**.
- Solução: criada função `carregarAbaBairros()` que **serializa** os carregamentos (um depois do outro).
- Adicionada proteção contra execuções simultâneas e **retry automático** (até 3 tentativas) em caso de erro de lock.

---

### ↔️ Barra de Rolagem Horizontal Sticky — Controle Interno de Denúncias
- Reestruturada a planilha de denúncias com **scroll mirror**:
  - Barra de rolagem horizontal posicionada **acima do cabeçalho** da tabela.
  - Barra usa `position: sticky; top: 0;` — desce junto com a tela.
  - Sincronização via JavaScript entre a barra de cima e o scroll da tabela.

---

### ↔️ Barra de Rolagem Horizontal Sticky — Histórico Geral
- Aplicada a mesma técnica de scroll mirror na tabela do **Histórico Geral**.
- Substituída a abordagem antiga de `transform: rotateX(180deg)` por uma solução mais robusta com sincronização via JS.
- Funciona tanto na visualização **"Todos"** quanto em **categorias específicas** (NP, AI, AR, Ofício, etc.).

---

### 📝 Ajuste de Textos no Modal de Vencidos (aba NP)
- Subtítulos das seções no modal de vencidos agora mencionam explicitamente **"Notificações Preliminares"** em vez de texto genérico:
  - "⚠️ Notificações Preliminares vencidas com Auto de Infração vinculado"
  - "🔴 Notificações Preliminares vencidas sem Auto de Infração"

## 🆕 Atualizações Recentes (12/05/2026) — Permissões do Administrativo de Posturas

### 👤 Administrativo de Posturas — Acesso à Aba Bairros (Somente Visualização)
- **Antes**: o cargo **Administrativo de Posturas** não tinha acesso à aba **Bairros**.
- **Agora**: o menu **"Bairros"** é exibido na sidebar para Administrativo de Posturas.
- **Restrições de gerenciamento** (todos os botões abaixo são **ocultos** automaticamente):
  - ❌ **Nova Área**
  - ❌ **Rotação de Áreas**
  - ❌ **Rotação de Bairros**
  - ❌ **Atribuir Fiscal** (dentro de cada área)
  - ❌ **Excluir Área** (dentro de cada área)
  - ❌ **Vincular Área** (dropdown dentro de cada bairro)
  - ❌ **Excluir Bairro** (dentro de cada bairro)
- **Permissão mantida**:
  - ✅ **Novo Bairro**: Administrativo de Posturas **pode adicionar** novos bairros.
- **Recursos visíveis**:
  - ✅ Gráfico **"Peso por Bairro (Top 10)"**
  - ✅ Ranking **"Áreas com Maior Demanda"**
  - ✅ Botão **"Baixar Dados"** (exportação Excel)
  - ✅ Botão **"Controle Interno de Denúncias"** (navegação para a aba de denúncias)

---

### 🔒 Controle Interno de Denúncias — Permissões por Perfil
- **Gerente de Posturas (GP) ou superior** (Diretor, Secretário): pode **criar, editar e excluir** qualquer registro sem restrição.
- **Administrativo de Posturas**:
  - ✅ **Pode criar** novas linhas normalmente.
  - ✅ **Edição completa**: pode **editar** qualquer registro do Controle Interno de Denúncias sem restrição.
  - ❌ **Exclusão restrita**: só pode **excluir** registros que **ele mesmo criou**.
- **Demais usuários** (Fiscais, etc.): só podem editar/excluir registros **criados por eles mesmos** (`created_by === userId`) sem restrição de tempo.

---


---

### 👥 Campo "Encaminhado para" — Busca Livre por Usuário
- **Antes**: campo era um `<select>` limitado apenas a **Fiscais de Posturas**.
- **Agora**: campo transformado em **input de busca com autocomplete** (`<input>` + `<datalist>`).
  - A pessoa digita o nome e o sistema sugere usuários cadastrados.
  - Ao selecionar (ou sair do campo), o ID do usuário é sincronizado automaticamente para um campo hidden.
- **Quem aparece na lista**: **todos os usuários do sistema** cadastrados na tabela `profiles`, **exceto**:
  - ❌ Consórcio
  - ❌ Analistas do Consórcio
- Inclusive o **próprio usuário logado** aparece na lista (pode encaminhar para si mesmo).
- No salvamento, o sistema continua registrando o `id` do usuário selecionado e seu `full_name` no banco.

---


### 🔄 Ordem das Colunas "Prazo" e "Data Entrega" Invertida
- **Antes**: na tabela e no modal de denúncias, a ordem era **Data Entrega → Prazo**.
- **Agora**: a ordem foi invertida para **Prazo → Data Entrega** em todos os lugares:
  - Tabela do **Controle Interno de Denúncias** (`renderizarTabelaDenuncias`)
  - Modal de **criação/edição** de denúncias
  - Documentação de campos opcionais por tipo de demanda

---
## 🆕 Atualizações Recentes (15/05/2026) — Validações no Controle Processual (16.x)

### 🛡️ Novas Camadas de Segurança Contra Duplicidade
- Implementadas validações inteligentes específicas para categorias do módulo **Controle Processual (16.x)**.
- O sistema agora verifica automaticamente o histórico pessoal do usuário antes de permitir novos cadastros duplicados.
- As consultas foram otimizadas para manter o carregamento rápido e sem travamentos na interface.
- Em caso de bloqueio, o botão de salvamento é restaurado automaticamente para evitar congelamentos no modal.

### 📋 Regras de Unicidade Adicionadas
| Categoria | Critério de Bloqueio |
| :--- | :--- |
| **16.1 — Notificação Preliminar** | **N° da Notificação** |
| **16.3 — Aviso de Recebimento (AR)** | **N° do AR** |
| **16.6 — Protocolo** | **N° do Protocolo** |

### ⚙️ Comportamento da Validação
- A verificação ocorre apenas durante novos cadastros (`!modoEdicao`).
- A busca considera apenas registros pertencentes ao usuário autenticado (`user_id`).
- O sistema utiliza comparação normalizada (`trim`) para evitar duplicidades com espaços extras.
- Em caso de duplicidade:
  - o salvamento é interrompido;
  - um alerta visual via SweetAlert2 é exibido;
  - o botão "Salvar" é reativado automaticamente.

---

## 🆕 Atualizações Recentes (20/05/2026) — Produtividade, Numeração e Rascunhos

### 📈 Carregamento Limitless e Refinamento de Componentes
- **Histórico Geral Sem Limites:** O sistema agora utiliza buscas assíncronas em lotes, removendo a trava de 1000 registros para garantir que nenhum histórico (mesmo utilizando filtros profundos) deixe de ser contabilizado ou visualizado.
- **Simplificação de Certidão (1.8):** Consolidação dos antigos campos "Rua", "Nº" e "Bairro" em um único campo genérico "Endereço do Autuado", impactando tanto a exibição do popup quanto a template de geração em PDF.
- **Melhoria no Ofício (1.4):** Inclusão do campo opcional "CPF/CNPJ" na geração nativa dos templates de documento.

### 🔢 Fila Global de Numeração e Integridade
- **Reutilização Sistêmica:** Ao invés de causar saltos na numeração ("buracos"), quando um documento que exige N° sequencial (como Autos ou Ofícios) for deletado ou um rascunho cancelado, o sistema executa a função RPC `devolver_numero_sequencial`, que insere esse identificador na fila pública. O próximo documento usará este número reaproveitado.
- **Segurança de Geração (Rascunhos):** Foi consertada uma brecha silenciosa na função de autenticação `getAuthUser` usada nas assinaturas de documentos via editor HTML, e implementadas barreiras sólidas onde, caso o banco retenha o "Rascunho" por configurações de RLS ou latência, a interface apresenta erros amigáveis bloqueando a quebra do módulo.

---

## 🗺️ Sistema de Mapa Geográfico (Bairros e Áreas)

O sistema utiliza **Leaflet.js** para renderizar um mapa interativo que correlaciona os **bairros cadastrados no banco de dados** (tabela `bairros` no Supabase) com os **polígonos territoriais** extraídos do OpenStreetMap (GeoJSON).

### 📂 Fonte dos Dados

| Camada | Origem | Arquivo / Tabela |
|---|---|---|
| **Pontos (marcadores)** | Banco de dados | `bairros` (Supabase) — `latitude`, `longitude`, `geolocalizacao` |
| **Polígonos de bairros** | OpenStreetMap | `assets/geojson/bairros_divinopolis.geojson` |
| **Limite municipal** | OpenStreetMap | `assets/geojson/municipio_divinopolis.geojson` |

### 🔗 Como os Bairros se Conectam aos Polígonos

O matching é feito por **nome normalizado**:

1. O nome do bairro no banco e o nome do polígono no GeoJSON são normalizados:
   - Convertido para minúsculas
   - Removidos acentos e caracteres especiais
   - Removidos prefixos como "Bairro"
   - Espaços e pontuação removidos

2. Se os nomes normalizados forem **idênticos**, o polígono é vinculado automaticamente ao bairro.

3. Se os nomes forem **diferentes**, é necessário um **alias** no código (`aliasesBairrosGeo`):

```javascript
// Em assets/js/gerente.js e painel.html
var aliasesBairrosGeo = {
    'chanadour': 'chanadours',                           // GeoJSON "Chanadour" → Banco "Chanadours"
    'condominiovilleroyale': 'condominiovileroyalle',    // GeoJSON "Ville Royale" → Banco "Vile Royalle"
    'nossasenhoradagraca': 'nossasenhoradasgracas',      // GeoJSON "Nossa Senhora da Graça" → Banco "Nossa Senhora das Graças"
    'levindopaulapereira': 'lppereira',                  // GeoJSON "Levindo Paula Pereira" → Banco "L. P. Pereira"
    'nucleocomerciallevindopaulapereira': 'nucleolppereira', // GeoJSON "Núcleo Comercial..." → Banco "Núcleo L. P Pereira"
    'parquejardimcapitaosilva': 'jardimcapitaosilva',    // GeoJSON "Parque Jardim Capitão Silva" → Banco "Jardim Capitão Silva"
    'joseantoniogoncalves': 'jagoncalves',               // GeoJSON "José Antônio Gonçalves" → Banco "J.A Gonçalves"
    'residencialwalchirresendecosta': 'residencialwalchirresende', // GeoJSON "Walchir Resende Costa" → Banco "Walchir Resende"
    // ... etc
};
```

> ⚠️ **Para adicionar um novo alias:** localize o nome exato no GeoJSON e no banco, normalize ambos manualmente, e adicione a entrada no objeto `aliasesBairrosGeo` tanto em `assets/js/gerente.js` quanto em `painel.html`.

### 👨‍👧 Relação Pai-Filho (Prolongamentos)

Bairros do tipo "Prolongamento" não possuem polígono próprio — eles herdam o polígono do bairro pai. O objeto `bairrosFilhosDoPoligono` define essas relações:

```javascript
var bairrosFilhosDoPoligono = {
    'jardimbelvedere': ['jardimbelvedereii'],        // Jardim Belvedere I + II compartilham o mesmo polígono
    'joseantoniogoncalves': ['prolongamentojagoncalves'],
    'tiete': ['prolongamentotiete'],
    // ... etc
};
```

**Comportamento:**
- O marcador do filho é **removido** do mapa quando o polígono do pai é renderizado
- Clicar no nome do filho na lista centraliza no ponto do filho, mas abre o **popup do polígono do pai**
- Isso evita bolinhas sobrepostas ao polígono

### 📍 Correções de Coordenadas Realizadas

Durante o mapeamento, diversos bairros tiveram suas coordenadas corrigidas para ficarem dentro do polígono correto:

| Bairro | Motivo da Correção |
|---|---|
| **Prolongamentos** (34+) | Coordenadas movidas para o **centroide** do polígono do bairro pai |
| **Chanadours** | Nome no GeoJSON é "Chanadour" (singular) — alias + centroide aplicados |
| **Condomínio Vile Royalle** | Nome no GeoJSON é "Condomínio Ville Royale" — alias + coordenada adicionada |
| **Nossa Senhora das Graças** | Nome no GeoJSON é "Nossa Senhora da Graça" — alias + centroide aplicados |
| **J. K** | Sem coordenadas — adicionado centroide do polígono "JK" |
| **Jardim Belvedere I e II** | Ambos reposicionados para o mesmo centroide do polígono único |

Todas as correções estão refletidas na tabela `bairros` do Supabase e no arquivo `PERMISSOES_SETUP.md` (seção de seed/upsert).

### 🗺️ Funcionalidades do Mapa

#### Busca de Bairros
- Campo de filtro na sidebar filtra a lista de bairros em tempo real
- Clique no nome do bairro:
  - Se tiver **polígono**: faz `fitBounds` no polígono (zoom no nível das ruas, max 17)
  - Se não tiver polígono: zoom 17 no ponto do marcador

#### Busca de Endereços (Nominatim)
- Campo secundário abaixo do filtro de bairros
- Digite "Rua Alameda", "Avenida Paraná", etc.
- Consulta a API gratuita **Nominatim** (OpenStreetMap) restrita à área de Divinópolis/MG
- Adiciona um marcador temporário no local encontrado com zoom 18

#### Popup dos Polígonos
- Os popups dos polígonos possuem um **offset de 80 pixels para baixo** (`offset: L.point(0, 80)`) para não ficarem cortados na parte superior da tela
- Desktop e mobile aplicam o mesmo deslocamento

#### Legenda de Áreas
- Abaixo do mapa (canto inferior direito) há uma legenda colorida com as áreas de atuação
- Clicar em uma área destaca/apaga os bairros pertencentes a ela

### 🛠️ Manutenção do Mapa

#### Adicionar um novo alias (bairro com nome diferente no GeoJSON)
1. Abra `assets/js/gerente.js` e localize `aliasesBairrosGeo`
2. Adicione a entrada: `'nomegeojson': 'nomebanco'`
3. Faça o mesmo em `painel.html` (seção equivalente no código mobile)
4. Recarregue a página

#### Adicionar um novo prolongamento
1. Localize `bairrosFilhosDoPoligono` em ambos os arquivos
2. Adicione o pai e o filho: `'paisemprolongamento': ['prolongamentopai']`
3. Certifique-se de que o pai tenha coordenada correta no banco

#### Adicionar polígonos novos (GeoJSON)
O arquivo `assets/geojson/bairros_divinopolis.geojson` segue o padrão GeoJSON:
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": { "name": "Nome do Bairro" },
      "geometry": { "type": "Polygon", "coordinates": [...] }
    }
  ]
}
```

Para adicionar novos polígonos, edite o arquivo GeoJSON (ex: via QGIS ou geojson.io) e adicione novas features com a propriedade `name` correspondendo ao nome do bairro no banco (ou adicione um alias).

> 📌 **Nota:** O sistema também aceita carregar o GeoJSON via variável global `geojsonBairrosDivinopolis` (útil para evitar problemas de CORS em `file://`).

---

## 🆕 Atualizações Recentes (27/05/2026) — Estabilidade e Dilação de Prazo

### ⏱️ Separação Visual: Dilação de Prazo (GP+)
- **Histórico Geral (Aba NP)**: A lista de Notificações Preliminares "No prazo" foi dividida em duas tabelas para facilitar o acompanhamento:
  - **Notificações Preliminares (Sem Dilação)**
  - **Notificações com Dilação de Prazo ativas**
- **Modal de Vencidos (NP)**: A seção de NP vencidas sem Auto de Infração também foi dividida, destacando primeiro as notificações que tiveram dilação de prazo vencida, seguidas das notificações com vencimento original expirado.
- **Colunas Dinâmicas**: Para registros com dilação, o sistema exibe duas colunas de datas: "Data Venc. Original" e "Dilação de Prazo".
- **Exportação Consistente**: Relatórios HTML e exportações ZIP respeitam as novas tabelas e incluem as colunas adicionais de dilação de prazo.

### 📅 Correção de Datas Automáticas em Registros Antigos
- **Bug Fix**: Notificações antigas cujo status era alterado para "ATENDIDO" (mas que não possuíam data salva no banco) estavam exibindo a data de hoje.
- **Solução**: A data automática só é injetada quando o fiscal seleciona ativamente a opção "ATENDIDO" no momento da ação, mantendo os registros antigos com o campo vazio, a menos que sejam explicitamente atualizados.

### 🛡️ Prevenção de Saltos na Numeração Sequencial (Rollback Automático)
- **O Problema**: Se a geração de um documento oficial (Auto de Infração, Ofício, etc.) falhasse no banco de dados (ex: erro de internet ou RLS), o número sequencial recém-gerado era perdido, criando um "buraco" na numeração.
- **A Solução**: Implementado um sistema de **Rollback (Reversão)** em todos os editores de documentos (Auto, Ofício, Relatório, Réplica, Certidão, Dívida Ativa) e na função principal `salvarRegistro`. 
- **Como Funciona**: Ao interceptar qualquer erro na inserção no banco, o sistema aciona silenciosamente a RPC `devolver_numero_sequencial`, retornando o identificador para a tabela `numeros_disponiveis`. A sequência permanece íntegra para o próximo documento.

### 📅 Extensão de Prazo em Tarefas e Subtarefas
- **Solicitação de Responsável**: Agora qualquer responsável pode solicitar extensão de prazo em tarefas ou subtarefas (mesmo se estiverem atrasadas), clicando no botão "📅 Solicitar extensão de prazo".
- **Notificação e Aprovação Integrada**: A solicitação notifica automaticamente o criador da tarefa ou gestores com permissão, para aprovar ou recusar a mudança através de um card flutuante amarelo na UI da tarefa. Em caso de subtarefas, os responsáveis da tarefa pai também são notificados e detém poder de controle.
- **Histórico Completo de Prazos (JSONB)**: Em vez de simplesmente sobrescrever o prazo, as extensões aprovadas preservam o prazo que foi substituído numa lista de histórico na coluna `prazo_anterior` (migrada para JSONB no Supabase). 
- **Display Discreto**: Na interface, todo o histórico anterior aparece listado acima do prazo vigente, em cinza claro e no formato tachado (riscado), conferindo fácil rastreabilidade e controle das falhas de cronograma sem poluir visualmente o card.

### ⏳ Nova Aba de "Pendentes" e Padronização Visual de Modais
- **Aba "Pendentes"**: Adicionada uma nova visualização no Histórico Geral para listar documentos pendentes. Um registro é filtrado como "Pendente" quando não possui nenhuma data de andamento preenchida (Data de Vencimento, Data de Recebimento, Histórico Admin ou Resposta do Fiscal).
- **Alerta de Atraso**: Registros pendentes há mais de 180 dias agora recebem um destaque visual vermelho direto na coluna "Período Pendente".
- **Padronização de UI e Ordenação Persistente**: O modal de Pendentes recebeu o mesmo design robusto dos demais. Foi adicionada correção em todos os modais (Vencidos, Não Efetivados, Atendidos, Pendentes) para garantir que o menu dropdown de "Ordenar por..." não perca a seleção após aplicar a ordem visual.
- **Nomenclatura Dinâmica em Não Efetivados**: A aba agora exibe o texto da categoria de documento correta baseada na seleção (ex: mostrando "Autos de Infração Devolvidos" em vez de ficar chumbado como "Notificações").
