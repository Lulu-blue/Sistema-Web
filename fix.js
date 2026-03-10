const fs = require('fs');
let html = fs.readFileSync('/home/luiza/Área de Trabalho/SEMAC/painel.html', 'utf8');

// Check structure around 'btn-limpeza-geral'
const index = html.indexOf('btn-limpeza-geral');
console.log(html.substring(index - 500, index + 800));
