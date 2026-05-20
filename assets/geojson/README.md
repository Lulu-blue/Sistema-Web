# GeoJSON dos Bairros de Divinópolis-MG

Este diretório contém o arquivo de polígonos dos bairros para o **Mapa Geográfico Interativo** do módulo de Bairros e Áreas.

## Arquivo Principal

| Arquivo | Descrição |
|---------|-----------|
| `bairros_divinopolis.geojson` | Polígonos dos bairros da cidade |

## Como Funciona no Sistema

O `gerente.js` tenta carregar este arquivo automaticamente ao inicializar o mapa:

1. **Se o GeoJSON existir e for válido**: o sistema renderiza os polígonos coloridos por área de atuação. Bairros que possuem polígono têm seu marcador de ponto (círculo) ocultado automaticamente.
2. **Se o arquivo não existir ou estiver vazio**: o sistema usa os pontos de latitude/longitude cadastrados no banco (`bairros.latitude` / `bairros.longitude`) como fallback.

## Estrutura Esperada do GeoJSON

Cada `Feature` deve ter, no mínimo, a propriedade `nome`:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "nome": "Centro"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[longitude, latitude], ...]]
      }
    }
  ]
}
```

### Regras de Matching

O sistema faz o matching entre o GeoJSON e os bairros do banco pelo **nome**, usando normalização inteligente:

- Ignora maiúsculas/minúsculas
- Remove acentos
- Ignora o prefixo "Bairro" (ex: "Bairro Centro" ↔ "Centro")
- Ignora caracteres especiais e espaços

> **Dica**: Não é necessário adicionar `bairro_id` (UUID) nas propriedades. O matching é feito pelo nome.

## Como Gerar o GeoJSON

### Opção 1: IBGE (Malhas Municipais)
1. Acesse: https://www.ibge.gov.br/geociencias/organizacao-do-territorio/malhas.html
2. Baixe a malha municipal mais recente de **Minas Gerais**.
3. Filtre apenas o município de **Divinópolis**.
4. Se disponível no nível de **bairros/localidades**, exporte como GeoJSON.

### Opção 2: OpenStreetMap (Overpass Turbo)
1. Acesse: https://overpass-turbo.eu/
2. Use a query abaixo para extrair os bairros de Divinópolis:

```overpass
[out:json][timeout:60];
area["name"="Divinópolis"]["admin_level"="8"]->.searchArea;
(
  relation["place"="suburb"](area.searchArea);
  relation["place"="neighbourhood"](area.searchArea);
);
out body;
>;
out skel qt;
```

3. Clique em **Run** e depois **Exportar → GeoJSON**.

### Opção 3: QGIS + Camada Vetorial
1. Desenhe ou importe os polígonos dos bairros no QGIS.
2. Certifique-se de que a tabela de atributos tenha uma coluna chamada `nome`.
3. Exporte a camada como GeoJSON (`Camada → Salvar Como → GeoJSON`).

## Estilo Automático no Mapa

Os polígonos recebem cores automaticamente conforme a área de atuação vinculada ao bairro no banco:

- Cor de preenchimento: cor da área (`mapaCoresAreas`)
- Borda: branca (`#ffffff`), espessura 1.5
- Opacidade de preenchimento: 45%
- Opacidade da borda: 80%

## Fallback para Pontos

Bairros cadastrados no sistema que **não possuem polígono** no GeoJSON continuam sendo exibidos como círculos (`L.circleMarker`) nas coordenadas do banco. Isso permite uma migração gradual — você pode adicionar polígonos aos poucos sem quebrar o mapa.
