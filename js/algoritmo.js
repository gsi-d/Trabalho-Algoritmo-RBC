document.addEventListener('DOMContentLoaded', () => {
    
    // --- 1. Seleção dos Elementos HTML e Variáveis Globais ---
    const botaoBuscar = document.getElementById('buscar-btn');
    const campoFilme = document.getElementById('filme-input');
    const listaRecomendacoes = document.getElementById('lista-recomendacoes');
    const tituloResultados = document.getElementById('resultados-titulo');

    let dadosDosFilmes = []; // Array para armazenar os dados dos filmes

    // Pesos para a Similaridade Global
    const pesos = {
        genres: 0.35,
        tagline: 0.25,
        production_companies: 0.20,
        runtime: 0.15,
        original_title: 0.05
    };

    // --- 2. Carregamento e Processamento do Arquivo CSV ---
    async function carregarDados() {
        try {
            const resposta = await fetch('BaseFilmes.csv');
            if (!resposta.ok) throw new Error('Erro ao carregar o arquivo CSV.');
            const textoCSV = await resposta.text();
            dadosDosFilmes = processarCSV(textoCSV);
            console.log("Dados dos filmes carregados com sucesso!");
        } catch (erro) {
            console.error(erro);
            listaRecomendacoes.innerHTML = `<li class="placeholder">${erro.message}</li>`;
        }
    }

    function processarCSV(texto) {
        const linhas = texto.split('\n');
        const cabecalhos = linhas[0].split(',').map(h => h.trim());
        const idxTitulo = cabecalhos.indexOf('original_title');
        const idxGeneros = cabecalhos.indexOf('genres');
        const idxProdutoras = cabecalhos.indexOf('production_companies');
        const idxDuracao = cabecalhos.indexOf('runtime');
        const idxTagline = cabecalhos.indexOf('tagline');
        
        const dados = [];
        for (let i = 1; i < linhas.length; i++) {
            const valores = linhas[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
            if (valores.length < cabecalhos.length) continue;
            try {
                let generosStr = valores[idxGeneros];
                let produtorasStr = valores[idxProdutoras];
                const filme = {
                    original_title: valores[idxTitulo]?.trim() || "",
                    genres: (generosStr && generosStr.length > 2) ? JSON.parse(generosStr.slice(1, -1).replace(/""/g, '"')).map(g => g.name) : [],
                    production_companies: (produtorasStr && produtorasStr.length > 2) ? JSON.parse(produtorasStr.slice(1, -1).replace(/""/g, '"')).map(p => p.name) : [],
                    runtime: parseFloat(valores[idxDuracao]) || 0,
                    tagline: valores[idxTagline]?.trim().replace(/^"|"$/g, '') || ""
                };
                if (filme.original_title && filme.genres.length > 0) dados.push(filme);
            } catch (e) { continue; }
        }
        return dados;
    }

    // --- 3. ALGORITMO RBC PRINCIPAL ---
    
    function encontrarTop5Similares(tituloDoFilme) {
        // Encontra o filme de entrada na nossa base de dados
        const filmeDeEntrada = dadosDosFilmes.find(f => f.original_title.toLowerCase() === tituloDoFilme.toLowerCase());
        if (!filmeDeEntrada) {
            exibirResultados(tituloDoFilme, null); // null indica que o filme não foi encontrado
            return;
        }

        // Pré-cálculo para normalizar a duração (runtime)
        const duracoes = dadosDosFilmes.map(f => f.runtime);
        const duracaoMinima = Math.min(...duracoes);
        const duracaoMaxima = Math.max(...duracoes);
        const intervaloDuracao = duracaoMaxima - duracaoMinima;

        // Varrer a lista de filmes, comparar e calcular a similaridade de cada um
        const similaridades = dadosDosFilmes.map(filmeAtual => {
            if (filmeAtual.original_title === filmeDeEntrada.original_title) {
                return { titulo: filmeAtual.original_title, pontuacao: -1 }; // Ignora o próprio filme
            }

            // --- Cálculos de Similaridade Local ---

            // a) Gêneros
            const generosEntrada = new Set(filmeDeEntrada.genres);
            const generosAtual = new Set(filmeAtual.genres);
            const interseccaoGeneros = new Set([...generosEntrada].filter(g => generosAtual.has(g)));
            const uniaoGeneros = new Set([...generosEntrada, ...generosAtual]);
            const sim_generos = uniaoGeneros.size === 0 ? 0 : interseccaoGeneros.size / uniaoGeneros.size;

            // b) Produtoras
            const produtorasEntrada = new Set(filmeDeEntrada.production_companies);
            const produtorasAtual = new Set(filmeAtual.production_companies);
            const interseccaoProdutoras = new Set([...produtorasEntrada].filter(c => produtorasAtual.has(c)));
            const uniaoProdutoras = new Set([...produtorasEntrada, ...produtorasAtual]);
            const sim_produtoras = uniaoProdutoras.size === 0 ? 0 : interseccaoProdutoras.size / uniaoProdutoras.size;

            // c) Duração
            const sim_duracao = 1 - (Math.abs(filmeDeEntrada.runtime - filmeAtual.runtime) / intervaloDuracao);

            // d) Tagline
            const palavrasTaglineEntrada = new Set(filmeDeEntrada.tagline.toLowerCase().split(/\s+/));
            const palavrasTaglineAtual = new Set(filmeAtual.tagline.toLowerCase().split(/\s+/));
            const interseccaoTagline = new Set([...palavrasTaglineEntrada].filter(w => palavrasTaglineAtual.has(w)));
            const uniaoTagline = new Set([...palavrasTaglineEntrada, ...palavrasTaglineAtual]);
            const sim_tagline = uniaoTagline.size === 0 ? 0 : interseccaoTagline.size / uniaoTagline.size;

            // e) Título
            const palavrasTituloEntrada = new Set(filmeDeEntrada.original_title.toLowerCase().split(/\s+/));
            const palavrasTituloAtual = new Set(filmeAtual.original_title.toLowerCase().split(/\s+/));
            const interseccaoTitulo = new Set([...palavrasTituloEntrada].filter(w => palavrasTituloAtual.has(w)));
            const uniaoTitulo = new Set([...palavrasTituloEntrada, ...palavrasTituloAtual]);
            const sim_titulo = uniaoTitulo.size === 0 ? 0 : interseccaoTitulo.size / uniaoTitulo.size;

            // --- Cálculo de Similaridade Global Ponderada ---
            const similaridadeGlobal = 
                sim_generos * pesos.genres +
                sim_produtoras * pesos.production_companies +
                sim_duracao * pesos.runtime +
                sim_tagline * pesos.tagline +
                sim_titulo * pesos.original_title;
            
            return { titulo: filmeAtual.original_title, pontuacao: similaridadeGlobal };
        });
        
        // Ordena pela pontuação e pega os 5 melhores
        const top5 = similaridades.sort((a, b) => b.pontuacao - a.pontuacao).slice(0, 5);

        exibirResultados(filmeDeEntrada.original_title, top5);
    }

    // --- 4. Funções de Exibição e Eventos ---

    function exibirResultados(tituloFilmeEntrada, top5) {
        if (!top5) {
            tituloResultados.innerText = `Resultados`;
            listaRecomendacoes.innerHTML = `<li class="placeholder">Filme "${tituloFilmeEntrada}" não encontrado.</li>`;
            return;
        }

        tituloResultados.innerText = `Recomendações para "${tituloFilmeEntrada}"`;
        listaRecomendacoes.innerHTML = ''; 

        top5.forEach(filme => {
            const itemLista = document.createElement('li');
            const percentual = (filme.pontuacao * 100).toFixed(2);
            itemLista.innerHTML = `${filme.titulo} <span class="similaridade">Similaridade: ${percentual}%</span>`;
            listaRecomendacoes.appendChild(itemLista);
        });
    }

    botaoBuscar.addEventListener('click', () => {
        const busca = campoFilme.value.trim();
        if (busca) {
            listaRecomendacoes.innerHTML = `<li class="placeholder">Buscando...</li>`;
            encontrarTop5Similares(busca);
        }
    });
    
    campoFilme.addEventListener('keyup', (evento) => {
        if (evento.key === 'Enter') botaoBuscar.click();
    });

    carregarDados();
});