-- CORREÇÕES DE COORDENADAS DOS BAIRROS
-- Baseado no centro do polígono do OpenStreetMap (GeoJSON)
-- Data: 2026-05-15
--
-- 5 bairros com coordenadas fora do próprio polígono:

-- Manoel Valinhas: coordenada quase correta, ajuste fino
UPDATE bairros SET latitude = -20.1284300, longitude = -44.8721963 WHERE nome = 'Manoel Valinhas';

-- Maria Peçanha: coordenada MUITO ERRADA (corrigida ~7km)
UPDATE bairros SET latitude = -20.1804787, longitude = -44.8795814 WHERE nome = 'Maria Peçanha';

-- Morada Nova: coordenada MUITO ERRADA (corrigida ~8km)
UPDATE bairros SET latitude = -20.1712747, longitude = -44.9086675 WHERE nome = 'Morada Nova';

-- Morumbi: coordenada MUITO ERRADA (corrigida ~9km)
UPDATE bairros SET latitude = -20.2007709, longitude = -44.9225341 WHERE nome = 'Morumbi';

-- Santa Cruz: coordenada MUITO ERRADA (corrigida ~10km)
UPDATE bairros SET latitude = -20.1108540, longitude = -44.9799086 WHERE nome = 'Santa Cruz';

-- São Roque: coordenada estava no lugar do bairro Orion (corrigida via geocodificação)
UPDATE bairros SET latitude = -20.1368470, longitude = -44.9211420 WHERE nome = 'São Roque';

-- 2 bairros sem coordenadas e sem polígono no GeoJSON:
-- Núcleo L. P Pereira: definir manualmente no mapa
-- C.H. F Vivendas da Serra: definir manualmente no mapa

-- Correções adicionais (verificação 2024-05-18)
-- J.K: coordenada estava no Bairro do Carmo, corrigido para o polígono JK
UPDATE bairros SET latitude = -20.2027977, longitude = -44.9149871, geolocalizacao = ST_SetSRID(ST_MakePoint(-44.9149871, -20.2027977), 4326) WHERE nome = 'J. K';

-- Chanadours: coordenada estava errada, corrigida
UPDATE bairros SET latitude = -20.1792753, longitude = -44.9163604, geolocalizacao = ST_SetSRID(ST_MakePoint(-44.9163604, -20.1792753), 4326) WHERE nome = 'Chanadours';

-- Residêncial Quinta das Palmeiras: coordenada estava errada, corrigida
UPDATE bairros SET latitude = -20.1806662, longitude = -44.8848364, geolocalizacao = ST_SetSRID(ST_MakePoint(-44.8848364, -20.1806662), 4326) WHERE nome = 'Residêncial Quinta das Palmeiras';

-- Vila Roseira: coordenada estava errada, corrigida
UPDATE bairros SET latitude = -20.1746341, longitude = -44.8471138, geolocalizacao = ST_SetSRID(ST_MakePoint(-44.8471138, -20.1746341), 4326) WHERE nome = 'Vila Roseira';

-- Correções de coordenadas para prolongamentos (centroide do bairro pai)
UPDATE bairros SET latitude = -20.1011191, longitude = -44.8753985, geolocalizacao = ST_SetSRID(ST_MakePoint(-44.8753985, -20.1011191), 4326) WHERE nome = 'Prolongamento Jardim Candelária';
UPDATE bairros SET latitude = -20.0970437, longitude = -44.8699375, geolocalizacao = ST_SetSRID(ST_MakePoint(-44.8699375, -20.0970437), 4326) WHERE nome = 'Prologamento Eldorado';
UPDATE bairros SET latitude = -20.1575710, longitude = -44.8750655, geolocalizacao = ST_SetSRID(ST_MakePoint(-44.8750655, -20.1575710), 4326) WHERE nome = 'Prologamento Interlagos';
UPDATE bairros SET latitude = -20.1279938, longitude = -44.8914130, geolocalizacao = ST_SetSRID(ST_MakePoint(-44.8914130, -20.1279938), 4326) WHERE nome = 'Prolongamento São Sebastião';
UPDATE bairros SET latitude = -20.1604571, longitude = -44.8832692, geolocalizacao = ST_SetSRID(ST_MakePoint(-44.8832692, -20.1604571), 4326) WHERE nome = 'Prolongamento Antônio Fonseca';
UPDATE bairros SET latitude = -20.1730723, longitude = -44.8660709, geolocalizacao = ST_SetSRID(ST_MakePoint(-44.8660709, -20.1730723), 4326) WHERE nome = 'Prolongamento Paraíso';
UPDATE bairros SET latitude = -20.1648756, longitude = -44.9205111, geolocalizacao = ST_SetSRID(ST_MakePoint(-44.9205111, -20.1648756), 4326) WHERE nome = 'Prolongamento J.A Gonçalves';
UPDATE bairros SET latitude = -20.1349776, longitude = -44.8730633, geolocalizacao = ST_SetSRID(ST_MakePoint(-44.8730633, -20.1349776), 4326) WHERE nome = 'Prolongamento Espírito Santo';
UPDATE bairros SET latitude = -20.2064684, longitude = -44.9252823, geolocalizacao = ST_SetSRID(ST_MakePoint(-44.9252823, -20.2064684), 4326) WHERE nome = 'Prolongamento Jardim Copacabana';
UPDATE bairros SET latitude = -20.1311693, longitude = -44.8843140, geolocalizacao = ST_SetSRID(ST_MakePoint(-44.8843140, -20.1311693), 4326) WHERE nome = 'Prolongamento Santa Clara';
UPDATE bairros SET latitude = -20.1367391, longitude = -44.8873686, geolocalizacao = ST_SetSRID(ST_MakePoint(-44.8873686, -20.1367391), 4326) WHERE nome = 'Prolongamento Vila Cruzeiro';
UPDATE bairros SET latitude = -20.1121540, longitude = -44.9096094, geolocalizacao = ST_SetSRID(ST_MakePoint(-44.9096094, -20.1121540), 4326) WHERE nome = 'Prolongamento Nova Fortaleza';
UPDATE bairros SET latitude = -20.1385866, longitude = -44.9167188, geolocalizacao = ST_SetSRID(ST_MakePoint(-44.9167188, -20.1385866), 4326) WHERE nome = 'Prolongamento Orion';
UPDATE bairros SET latitude = -20.1562408, longitude = -44.8643776, geolocalizacao = ST_SetSRID(ST_MakePoint(-44.8643776, -20.1562408), 4326) WHERE nome = 'Prolongamento Ponte Funda';
UPDATE bairros SET latitude = -20.1346576, longitude = -44.8602863, geolocalizacao = ST_SetSRID(ST_MakePoint(-44.8602863, -20.1346576), 4326) WHERE nome = 'Prolongamento São Lucas';
UPDATE bairros SET latitude = -20.1701903, longitude = -44.9084349, geolocalizacao = ST_SetSRID(ST_MakePoint(-44.9084349, -20.1701903), 4326) WHERE nome = 'Prolongamento Morada Nova';
UPDATE bairros SET latitude = -20.1345410, longitude = -44.9251057, geolocalizacao = ST_SetSRID(ST_MakePoint(-44.9251057, -20.1345410), 4326) WHERE nome = 'Prolongamento Sion';
UPDATE bairros SET latitude = -20.1322709, longitude = -44.8886226, geolocalizacao = ST_SetSRID(ST_MakePoint(-44.8886226, -20.1322709), 4326) WHERE nome = 'Prolongamento Afonso Pena';
UPDATE bairros SET latitude = -20.1133445, longitude = -44.8680553, geolocalizacao = ST_SetSRID(ST_MakePoint(-44.8680553, -20.1133445), 4326) WHERE nome = 'Prolongamento Vila Romana';
UPDATE bairros SET latitude = -20.1738574, longitude = -44.9062603, geolocalizacao = ST_SetSRID(ST_MakePoint(-44.9062603, -20.1738574), 4326) WHERE nome = 'Prolongamento Bela Vista';
UPDATE bairros SET latitude = -20.1525912, longitude = -44.9009583, geolocalizacao = ST_SetSRID(ST_MakePoint(-44.9009583, -20.1525912), 4326) WHERE nome = 'Prolongamento Catalão';
UPDATE bairros SET latitude = -20.1305840, longitude = -44.8653265, geolocalizacao = ST_SetSRID(ST_MakePoint(-44.8653265, -20.1305840), 4326) WHERE nome = 'Prolongamento Manoel Valinhas';
UPDATE bairros SET latitude = -20.1437822, longitude = -44.9151016, geolocalizacao = ST_SetSRID(ST_MakePoint(-44.9151016, -20.1437822), 4326) WHERE nome = 'Prolongamento Tietê';
UPDATE bairros SET latitude = -20.1268827, longitude = -44.9100066, geolocalizacao = ST_SetSRID(ST_MakePoint(-44.9100066, -20.1268827), 4326) WHERE nome = 'Prolongamento Residencial Walchir Resende';
UPDATE bairros SET latitude = -20.1580528, longitude = -44.8563057, geolocalizacao = ST_SetSRID(ST_MakePoint(-44.8563057, -20.1580528), 4326) WHERE nome = 'Prolongamento Nações';
UPDATE bairros SET latitude = -20.1593443, longitude = -44.9034890, geolocalizacao = ST_SetSRID(ST_MakePoint(-44.9034890, -20.1593443), 4326) WHERE nome = 'Prolongamento São José';
UPDATE bairros SET latitude = -20.1351114, longitude = -44.8959506, geolocalizacao = ST_SetSRID(ST_MakePoint(-44.8959506, -20.1351114), 4326) WHERE nome = 'Prolongamento Jardim Capitão Silva';
UPDATE bairros SET latitude = -20.1348227, longitude = -44.8660151, geolocalizacao = ST_SetSRID(ST_MakePoint(-44.8660151, -20.1348227), 4326) WHERE nome = 'Prolongamento Halim Souki';
UPDATE bairros SET latitude = -20.1532569, longitude = -44.8918683, geolocalizacao = ST_SetSRID(ST_MakePoint(-44.8918683, -20.1532569), 4326) WHERE nome = 'Prolongamento Vila Operária';
UPDATE bairros SET latitude = -20.1606811, longitude = -44.9312465, geolocalizacao = ST_SetSRID(ST_MakePoint(-44.9312465, -20.1606811), 4326) WHERE nome = 'Prolongamento Quintino';
UPDATE bairros SET latitude = -20.1456416, longitude = -44.9096187, geolocalizacao = ST_SetSRID(ST_MakePoint(-44.9096187, -20.1456416), 4326) WHERE nome = 'Prolongamento Planalto';
UPDATE bairros SET latitude = -20.1315074, longitude = -44.8382804, geolocalizacao = ST_SetSRID(ST_MakePoint(-44.8382804, -20.1315074), 4326) WHERE nome = 'Prolongamento Jardim dos Candidés';
UPDATE bairros SET latitude = -20.1552018, longitude = -44.8872456, geolocalizacao = ST_SetSRID(ST_MakePoint(-44.8872456, -20.1552018), 4326) WHERE nome = 'Prologamento Francisco Machado Filho';
UPDATE bairros SET latitude = -20.1163275, longitude = -44.8524314, geolocalizacao = ST_SetSRID(ST_MakePoint(-44.8524314, -20.1163275), 4326) WHERE nome = 'Prolongamento Icaraí';
UPDATE bairros SET latitude = -20.1811863, longitude = -44.9247035, geolocalizacao = ST_SetSRID(ST_MakePoint(-44.9247035, -20.1811863), 4326) WHERE nome = 'Prolongamento Jardim das Acácias';

-- Correções L. P. Pereira / Núcleo L. P. Pereira
UPDATE bairros SET latitude = -20.1327626, longitude = -44.9095924, geolocalizacao = ST_SetSRID(ST_MakePoint(-44.9095924, -20.1327626), 4326) WHERE nome = 'L. P. Pereira';
UPDATE bairros SET latitude = -20.1327626, longitude = -44.9095924, geolocalizacao = ST_SetSRID(ST_MakePoint(-44.9095924, -20.1327626), 4326) WHERE nome = 'Prolongamento L. P. Pereira';
UPDATE bairros SET latitude = -20.1299384, longitude = -44.9138145, geolocalizacao = ST_SetSRID(ST_MakePoint(-44.9138145, -20.1299384), 4326) WHERE nome = 'Núcleo L. P Pereira';
UPDATE bairros SET latitude = -20.2035356, longitude = -44.9162054 WHERE nome = 'J. K';
UPDATE bairros SET latitude = -20.1812572, longitude = -44.9170766 WHERE nome = 'Chanadours';
UPDATE bairros SET latitude = -20.1823265, longitude = -44.9187175 WHERE nome = 'Condomínio Vile Royalle';
UPDATE bairros SET latitude = -20.1740789, longitude = -44.9048147 WHERE nome = 'Jardim Belvedere II';
UPDATE bairros SET latitude = -20.1740789, longitude = -44.9048147 WHERE nome = 'Jardim Belvedere';
UPDATE bairros SET latitude = -20.1623208, longitude = -44.8805297 WHERE nome = 'Nossa Senhora das Graças';

-- ============================================
-- TABELA PARA CONFIGURAÇÕES DO MAPA (EDITOR)
-- ============================================
-- Execute este SQL no Supabase Dashboard (SQL Editor)
-- para habilitar o salvamento de aliases, polígonos e pontos extras

CREATE TABLE IF NOT EXISTS public.mapa_configuracoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chave TEXT NOT NULL UNIQUE,
    valor JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id)
);

-- Política RLS: apenas usuários autenticados podem ler
ALTER TABLE public.mapa_configuracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mapa_config_select" ON public.mapa_configuracoes
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "mapa_config_upsert" ON public.mapa_configuracoes
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Índice único já garantido pela constraint UNIQUE(chave)

-- ============================================
-- REMOVER TABELA DE CONFIGURAÇÕES DO MAPA (se necessário)
-- ============================================
-- Execute apenas se quiser desfazer completamente o modo edição

