document.addEventListener('DOMContentLoaded', () => {

    // --- Seleção dos Elementos HTML e Variáveis Globais ---
    const botaoBuscar = document.getElementById('buscar-btn');
    const campoFilme = document.getElementById('filme-input');
    const listaRecomendacoes = document.getElementById('lista-recomendacoes');
    const tituloResultados = document.getElementById('resultados-titulo');

    let dadosDosFilmes = [];

    // Pesos para a Similaridade Global
    const pesos = {
        generos: 7,
        palavrasChave: 5,
        produtoras: 4,
        notaMedia: 3,
        titulo: 1
    };

    // --- Carregamento e Processamento do Arquivo CSV ---
    async function carregarDados() {
        try {
            const resposta = await fetch('BaseFilmes.csv');
            if (!resposta.ok) throw new Error('Erro ao carregar o arquivo CSV.');
            const textoCSV = await resposta.text();
            dadosDosFilmes = processarCSV(textoCSV);
            console.log(dadosDosFilmes)
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
        const idxPalavrasChave = cabecalhos.indexOf('keywords');
        const idxNotaMedia = cabecalhos.indexOf('vote_average');

        const dados = [];
        for (let i = 1; i < linhas.length; i++) {
            const valores = linhas[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
            if (valores.length < cabecalhos.length) continue;
            try {
                let generosStr = valores[idxGeneros];
                let produtorasStr = valores[idxProdutoras];
                let palavrasChaveStr = valores[idxPalavrasChave];
                const filme = {
                    original_title: valores[idxTitulo]?.trim() || "",
                    genres: (generosStr && generosStr.length > 2) ? JSON.parse(generosStr.slice(1, -1).replace(/""/g, '"')).map(g => g.name) : [],
                    production_companies: (produtorasStr && produtorasStr.length > 2) ? JSON.parse(produtorasStr.slice(1, -1).replace(/""/g, '"')).map(p => p.name) : [],
                    vote_average: parseFloat(valores[idxNotaMedia]) || 0,
                    keywords: (palavrasChaveStr && palavrasChaveStr.length > 2) ? JSON.parse(palavrasChaveStr.slice(1, -1).replace(/""/g, '"')).map(p => p.name) : [],
                };

                if (filme.original_title && filme.genres.length > 0) dados.push(filme);
            } catch (e) {
                console.log(e)
                continue;
            }
        }
        return dados;
    }

    // --- ALGORITMO RBC PRINCIPAL ---

    function encontrarTop5Similares(tituloDoFilme) {
        // Encontra o filme de entrada na nossa base de dados
        const filmeDeEntrada = dadosDosFilmes.find(f => f.original_title.toLowerCase().includes(tituloDoFilme.toLowerCase()));
        if (!filmeDeEntrada) {
            exibirResultados(tituloDoFilme, null); // null indica que o filme não foi encontrado
            return;
        }

        // Pré-cálculo para normalizar a nota média
        const notas = dadosDosFilmes.map(f => f.vote_average);
        const notaMinima = Math.min(...notas);
        const notaMaxima = Math.max(...notas);
        const intervaloNotas = notaMaxima - notaMinima;

        const generosEntrada = new Set(filmeDeEntrada.genres);
        const produtorasEntrada = new Set(filmeDeEntrada.production_companies);
        const palavrasChaveEntrada = new Set(filmeDeEntrada.keywords);
        const palavrasTituloEntrada = new Set(filmeDeEntrada.original_title.toLowerCase().split(/\s+/));

        console.log('filmeDeEntrada', filmeDeEntrada);
        console.log('intervaloNotas', intervaloNotas);

        console.log('generosEntrada', generosEntrada);
        console.log('produtorasEntrada', produtorasEntrada);
        console.log('palavrasChaveEntrada', palavrasChaveEntrada);
        console.log('palavrasTituloEntrada', palavrasTituloEntrada);

        // Varrer a lista de filmes, comparar e calcular a similaridade de cada um
        const similaridades = dadosDosFilmes.map(filmeAtual => {
            if (filmeAtual.original_title === filmeDeEntrada.original_title) {
                return { titulo: filmeAtual.original_title, pontuacao: -1 }; // Ignora o próprio filme
            }

            // --- Similaridade Local ---
            const generosAtual = new Set(filmeAtual.genres);
            const interseccaoGeneros = new Set([...generosEntrada].filter(g => generosAtual.has(g)));
            const uniaoGeneros = new Set([...generosEntrada, ...generosAtual]);
            const sim_generos = uniaoGeneros.size === 0 ? 0 : interseccaoGeneros.size / uniaoGeneros.size;

            const produtorasAtual = new Set(filmeAtual.production_companies);
            const interseccaoProdutoras = new Set([...produtorasEntrada].filter(c => produtorasAtual.has(c)));
            const uniaoProdutoras = new Set([...produtorasEntrada, ...produtorasAtual]);
            const sim_produtoras = uniaoProdutoras.size === 0 ? 0 : interseccaoProdutoras.size / uniaoProdutoras.size;

            const palavrasChaveAtual = new Set(filmeAtual.keywords);
            const interseccaoPalavrasChave = new Set([...palavrasChaveEntrada].filter(g => palavrasChaveAtual.has(g)));
            const uniaoPalavrasChave = new Set([...palavrasChaveEntrada, ...palavrasChaveAtual]);
            const sim_palavrasChave = uniaoPalavrasChave.size === 0 ? 0 : interseccaoPalavrasChave.size / uniaoPalavrasChave.size;

            const palavrasTituloAtual = new Set(filmeAtual.original_title.toLowerCase().split(/\s+/));
            const interseccaoTitulo = new Set([...palavrasTituloEntrada].filter(w => palavrasTituloAtual.has(w)));
            const uniaoTitulo = new Set([...palavrasTituloEntrada, ...palavrasTituloAtual]);
            const sim_titulo = uniaoTitulo.size === 0 ? 0 : interseccaoTitulo.size / uniaoTitulo.size;

            const sim_nota = 1 - (Math.abs(filmeDeEntrada.vote_average - filmeAtual.vote_average) / intervaloNotas);

            // --- Similaridade Global ---
            const similaridadePonderada =
                sim_generos * pesos.generos +
                sim_produtoras * pesos.produtoras +
                sim_nota * pesos.notaMedia +
                sim_palavrasChave * pesos.palavrasChave +
                sim_titulo * pesos.titulo;

            let somaTotalPesos = 0;

            for (const chave in pesos) {
                somaTotalPesos += pesos[chave];
            }

            const similaridadeGlobal = similaridadePonderada / somaTotalPesos;

            console.log('generosAtual', generosAtual);
            console.log('interseccaoGeneros', interseccaoGeneros);
            console.log('uniaoGeneros', uniaoGeneros);
            console.log('sim_generos', sim_generos);

            return { titulo: filmeAtual.original_title, pontuacao: similaridadeGlobal };
        });

        console.log('similaridades', similaridades);

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