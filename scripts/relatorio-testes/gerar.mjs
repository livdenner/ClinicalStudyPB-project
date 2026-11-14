#!/usr/bin/env node
/**
 * Consolida os relatórios de testes do projeto em um único Markdown (T25.1).
 *
 * Fontes lidas (todas opcionais; a ausência de uma fonte é registrada no relatório):
 * - Backend: XML JUnit do Surefire (`TEST-*.xml`);
 * - Web: JSON do Vitest (formato compatível com o Jest);
 * - Web E2E: JSON do Playwright;
 * - Mobile: JSON do Jest (`--json --outputFile`).
 *
 * Saída: `<pasta>/AAAA-MM-DD_HH-mm_<sha>.md`, com uma linha por teste, e o índice
 * `<pasta>/README.md`, que aponta para a última execução. Na CI, a pasta é
 * `docs/tests/execucoes/<branch>` (main ou development); localmente, `docs/tests/execucoes/local`.
 * Quando o commit testado é o merge de um PR, o relatório identifica a integração (PR, branch e título).
 * Uso e opções: `node scripts/relatorio-testes/gerar.mjs --ajuda`.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FUSO = "America/Fortaleza";
const PADRAO_ARQUIVO = /^(\d{4}-\d{2}-\d{2})_(\d{2})-(\d{2})_([0-9a-f]{7,40})(-\d+)?\.md$/;

export const ORIGENS = {
    backend: "Backend · JUnit",
    web: "Web · Vitest",
    e2e: "Web E2E · Playwright",
    mobile: "Mobile · Jest",
};

const RESULTADOS = {
    passou: "✅ passou",
    falhou: "❌ **falhou**",
    ignorado: "⏭️ **ignorado**",
    instavel: "⚠️ **instável**",
};

// ---------------------------------------------------------------------------
// Sanitização: o relatório é público no repositório, então nada de segredos.
// ---------------------------------------------------------------------------

const DOMINIOS_FICTICIOS = /\.(test|example|invalid|localhost|local)$|(^|\.)example\.(com|org|net)$/i;

/** Remove códigos ANSI, tokens, credenciais e dados pessoais de um texto. */
export function sanitizar(texto) {
    if (texto === undefined || texto === null) {
        return "";
    }
    return (
        String(texto)
            // eslint-disable-next-line no-control-regex
            .replace(/\u001b\[[0-9;]*m/g, "")
            .replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, "[token omitido]")
            .replace(/\b(Bearer|Basic)\s+[\w.+/=-]+/gi, "$1 [omitido]")
            .replace(
                /\b(senha|password|passwd|secret|segredo|token|api[_-]?key)(\s*[=:]\s*)("[^"]*"|'[^']*'|\S+)/gi,
                "$1$2[omitido]",
            )
            .replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, "[CPF omitido]")
            .replace(/[\w.+-]+@([\w-]+(?:\.[\w-]+)+)/g, (email, dominio) =>
                DOMINIOS_FICTICIOS.test(dominio) ? email : "[e-mail omitido]",
            )
    );
}

/** Prepara um texto para uma célula de tabela Markdown (uma linha, sem HTML). */
export function celula(texto, limite = 0) {
    let valor = sanitizar(texto).replace(/\s+/g, " ").trim();
    if (limite > 0 && valor.length > limite) {
        valor = `${valor.slice(0, limite - 1)}…`;
    }
    return valor
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\|/g, "\\|")
        .replace(/`/g, "'");
}

// ---------------------------------------------------------------------------
// Leitores
// ---------------------------------------------------------------------------

function decodificarXml(texto) {
    return texto
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
        .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
        .replace(/&amp;/g, "&");
}

function atributos(trecho) {
    const resultado = {};
    for (const [, nome, , valor] of trecho.matchAll(/([\w:.-]+)\s*=\s*(["'])([\s\S]*?)\2/g)) {
        resultado[nome] = decodificarXml(valor);
    }
    return resultado;
}

/** Converte `pacote.Classe$Aninhada` em `Classe › Aninhada`. */
function nomeDaClasse(classname) {
    const simples = classname.split(".").pop() ?? classname;
    return simples.split("$").join(" › ");
}

/** Lê o conteúdo de um XML JUnit (Surefire/Failsafe) e devolve um teste por `<testcase>`. */
export function lerJUnit(xml) {
    const testes = [];
    const padrao = /<testcase\b((?:[^>"']|"[^"]*"|'[^']*')*?)(\/>|>([\s\S]*?)<\/testcase>)/g;
    for (const [, cabecalho, , corpo = ""] of xml.matchAll(padrao)) {
        const attrs = atributos(cabecalho);
        let resultado = "passou";
        let motivo = "";
        const falha = corpo.match(/<(failure|error)\b((?:[^>"']|"[^"]*"|'[^']*')*?)(\/>|>([\s\S]*?)<\/\1>)/);
        const ignorado = corpo.match(/<skipped\b((?:[^>"']|"[^"]*"|'[^']*')*?)\/?>/);
        if (falha) {
            resultado = "falhou";
            const attrsFalha = atributos(falha[2]);
            motivo = attrsFalha.message || attrsFalha.type || decodificarXml(falha[4] ?? "").split("\n")[0];
        } else if (ignorado) {
            resultado = "ignorado";
            motivo = atributos(ignorado[1]).message ?? "";
        } else if (/<(flakyFailure|flakyError)\b/.test(corpo)) {
            resultado = "instavel";
            motivo = "passou após nova tentativa";
        }
        const segundos = Number.parseFloat(attrs.time);
        testes.push({
            origem: ORIGENS.backend,
            suite: nomeDaClasse(attrs.classname ?? ""),
            teste: attrs.name ?? "(sem nome)",
            resultado,
            duracaoMs: Number.isFinite(segundos) ? Math.round(segundos * 1000) : null,
            motivo,
        });
    }
    return testes;
}

/** Normaliza o caminho de um arquivo de teste para ficar relativo à raiz do repositório. */
export function caminhoRelativo(arquivo, raiz = RAIZ, prefixoPadrao = "") {
    if (!arquivo) {
        return "";
    }
    const normalizado = String(arquivo).replace(/\\/g, "/");
    const raizNormalizada = raiz.replace(/\\/g, "/").replace(/\/$/, "");
    if (normalizado.toLowerCase().startsWith(`${raizNormalizada.toLowerCase()}/`)) {
        return normalizado.slice(raizNormalizada.length + 1);
    }
    // Relatório gerado em outra máquina: corta a partir da pasta da aplicação.
    const marcador = normalizado.match(/(?:^|\/)((?:backend|web|mobile)\/(?:src|e2e)\/.*)$/);
    if (marcador) {
        return marcador[1];
    }
    if (!path.isAbsolute(normalizado) && prefixoPadrao) {
        return `${prefixoPadrao}${normalizado.replace(/^\.\//, "")}`;
    }
    return normalizado;
}

const STATUS_JEST = {
    passed: "passou",
    failed: "falhou",
    skipped: "ignorado",
    pending: "ignorado",
    todo: "ignorado",
    disabled: "ignorado",
    focused: "passou",
};

/** Lê o JSON do Vitest ou do Jest (`testResults[].assertionResults[]`). */
export function lerJestOuVitest(json, origem, raiz = RAIZ, prefixoPadrao = "") {
    const dados = typeof json === "string" ? JSON.parse(json) : json;
    const testes = [];
    for (const arquivo of dados.testResults ?? []) {
        const suite = caminhoRelativo(arquivo.name ?? arquivo.testFilePath, raiz, prefixoPadrao);
        const asserts = arquivo.assertionResults ?? arquivo.testResults ?? [];
        if (asserts.length === 0 && arquivo.status === "failed") {
            // O arquivo falhou antes de registrar testes (erro de import, sintaxe etc.).
            testes.push({
                origem,
                suite,
                teste: "(falha ao carregar o arquivo de teste)",
                resultado: "falhou",
                duracaoMs: null,
                motivo: (arquivo.message || arquivo.failureMessage || "").split("\n")[0],
            });
            continue;
        }
        for (const caso of asserts) {
            const nome = [...(caso.ancestorTitles ?? []), caso.title].filter(Boolean).join(" › ");
            const resultado = STATUS_JEST[caso.status] ?? "ignorado";
            testes.push({
                origem,
                suite,
                teste: nome || caso.fullName || "(sem nome)",
                resultado,
                duracaoMs: typeof caso.duration === "number" ? Math.round(caso.duration) : null,
                motivo: resultado === "falhou" ? String(caso.failureMessages?.[0] ?? "").split("\n")[0] : "",
            });
        }
    }
    // Erros fora dos testes (worker que não subiu, erro não tratado) não aparecem por arquivo,
    // mas marcam a execução como malsucedida; sem esta linha o relatório pareceria verde.
    if (dados.success === false && !testes.some((teste) => teste.resultado === "falhou")) {
        testes.push({
            origem,
            suite: "(execução)",
            teste: "(erro fora dos testes: a execução não terminou com sucesso)",
            resultado: "falhou",
            duracaoMs: null,
            motivo: "consulte o log da execução; arquivos de teste podem não ter rodado",
        });
    }
    return testes;
}

/** Lê o JSON do Playwright (suítes aninhadas → specs → testes por projeto → tentativas). */
export function lerPlaywright(json, raiz = RAIZ) {
    const dados = typeof json === "string" ? JSON.parse(json) : json;
    const testDir = dados.config?.rootDir ?? path.join(raiz, "web", "e2e");
    const testes = [];
    const projetos = new Set((dados.config?.projects ?? []).map((projeto) => projeto.name));

    const visitar = (suite, titulos) => {
        for (const spec of suite.specs ?? []) {
            const arquivo = caminhoRelativo(path.join(testDir, spec.file ?? suite.file ?? ""), raiz, "web/e2e/");
            for (const teste of spec.tests ?? []) {
                const tentativas = teste.results ?? [];
                const ultima = tentativas.at(-1);
                let resultado;
                if (teste.status === "skipped" || ultima?.status === "skipped") {
                    resultado = "ignorado";
                } else if (teste.status === "flaky") {
                    resultado = "instavel";
                } else if (teste.status === "unexpected") {
                    resultado = "falhou";
                } else {
                    resultado = "passou";
                }
                const sufixoProjeto = projetos.size > 1 && teste.projectName ? ` [${teste.projectName}]` : "";
                const erro = tentativas.find((tentativa) => tentativa.error)?.error?.message ?? "";
                const marcacao = [...(teste.annotations ?? []), ...(spec.annotations ?? [])].find(
                    (a) => a.type === "skip" || a.type === "fixme",
                );
                const anotacao = marcacao
                    ? `${marcacao.type === "fixme" ? "marcado como fixme" : "test.skip"}${marcacao.description ? `: ${marcacao.description}` : ""}`
                    : "";
                testes.push({
                    origem: ORIGENS.e2e,
                    suite: arquivo,
                    teste: [...titulos, spec.title].filter(Boolean).join(" › ") + sufixoProjeto,
                    resultado,
                    duracaoMs: tentativas.reduce((total, tentativa) => total + (tentativa.duration ?? 0), 0),
                    motivo:
                        resultado === "instavel"
                            ? `passou na tentativa ${tentativas.length}`
                            : resultado === "falhou"
                              ? erro.split("\n")[0]
                              : resultado === "ignorado"
                                ? anotacao
                                : "",
                });
            }
        }
        for (const filha of suite.suites ?? []) {
            visitar(filha, [...titulos, filha.title]);
        }
    };

    // O primeiro nível de suítes é o arquivo; o título dele já vai na coluna "Suíte".
    for (const suiteDoArquivo of dados.suites ?? []) {
        visitar(suiteDoArquivo, []);
    }
    return testes;
}

// ---------------------------------------------------------------------------
// Integração (PR) que originou a execução
// ---------------------------------------------------------------------------

/**
 * Identifica o PR a partir da mensagem do commit testado. Um merge do GitHub tem a forma
 * `Merge pull request #79 from dono/branch`, seguida de uma linha em branco e do título do PR.
 * Sem PR identificado, devolve só o título do commit.
 */
export function lerIntegracao(mensagem = "", numeroPr = "") {
    const linhas = String(mensagem)
        .split(/\r?\n/)
        .map((linha) => linha.trim());
    const assunto = linhas[0] ?? "";
    const merge = assunto.match(/^Merge pull request #(\d+) from [^/\s]+\/(\S+)/);
    if (merge) {
        const titulo = linhas.slice(1).find((linha) => linha.length > 0) ?? "";
        return { pr: Number(merge[1]), branch: merge[2], titulo, emRevisao: false };
    }
    if (numeroPr) {
        return { pr: Number(numeroPr), branch: "", titulo: assunto, emRevisao: true };
    }
    return assunto ? { pr: null, branch: "", titulo: assunto, emRevisao: false } : null;
}

export function descreverIntegracao(integracao, urlRepositorio = "") {
    if (!integracao) {
        return "";
    }
    const titulo = celula(integracao.titulo, 120);
    if (!integracao.pr) {
        return titulo;
    }
    const rotulo = `PR #${integracao.pr}`;
    const link = urlRepositorio ? `[${rotulo}](${urlRepositorio}/pull/${integracao.pr})` : rotulo;
    const branch = integracao.branch ? ` (\`${celula(integracao.branch)}\`)` : "";
    const estado = integracao.emRevisao ? " — em revisão, ainda não integrado" : "";
    return `${link}${branch}${titulo ? `: ${titulo}` : ""}${estado}`;
}

// ---------------------------------------------------------------------------
// Geração do Markdown
// ---------------------------------------------------------------------------

/** Data/hora no fuso do projeto, como partes numéricas com zero à esquerda. */
export function partesDaData(data, fuso = FUSO) {
    const partes = Object.fromEntries(
        new Intl.DateTimeFormat("en-CA", {
            timeZone: fuso,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hourCycle: "h23",
        })
            .formatToParts(data)
            .filter((parte) => parte.type !== "literal")
            .map((parte) => [parte.type, parte.value]),
    );
    return partes;
}

export function formatarDuracao(ms) {
    if (ms === null || ms === undefined) {
        return "—";
    }
    if (ms < 1000) {
        return `${ms} ms`;
    }
    const segundos = ms / 1000;
    if (segundos < 60) {
        return `${segundos.toFixed(2).replace(".", ",")} s`;
    }
    const minutos = Math.floor(segundos / 60);
    return `${minutos} min ${Math.round(segundos % 60)} s`;
}

/** "1 ignorado, 2 instáveis": ressalvas de uma execução sem falhas. */
function ressalvas({ ignorado = 0, instavel = 0 }) {
    return [
        ignorado ? `${ignorado} ${ignorado === 1 ? "ignorado" : "ignorados"}` : "",
        instavel ? `${instavel} ${instavel === 1 ? "instável" : "instáveis"}` : "",
    ]
        .filter(Boolean)
        .join(", ");
}

function contar(testes) {
    const contagem = { total: testes.length, passou: 0, falhou: 0, ignorado: 0, instavel: 0, duracaoMs: 0 };
    for (const teste of testes) {
        contagem[teste.resultado] += 1;
        contagem.duracaoMs += teste.duracaoMs ?? 0;
    }
    return contagem;
}

/**
 * Monta o Markdown de uma execução.
 * @param {object} execucao dados do commit, da data e das fontes lidas.
 */
export function gerarMarkdown(execucao) {
    const { testes, fontes, sha, branch, data, ambiente, urlRepositorio, urlExecucao, integracao = null } = execucao;
    const p = partesDaData(data);
    const curto = sha.slice(0, 7);
    const contagem = contar(testes);
    const ordem = Object.values(ORIGENS);
    const ordenados = [...testes].sort(
        (a, b) =>
            ordem.indexOf(a.origem) - ordem.indexOf(b.origem) ||
            a.suite.localeCompare(b.suite, "pt-BR") ||
            a.teste.localeCompare(b.teste, "pt-BR"),
    );
    const situacao =
        contagem.falhou > 0
            ? "❌ com falhas"
            : fontes.some((fonte) => !fonte.encontrada)
              ? "⚠️ incompleta (suíte não executada)"
              : contagem.ignorado + contagem.instavel === 0
                ? "✅ todos os testes passaram"
                : `✅ sem falhas (${ressalvas(contagem)})`;

    const resumoMaquina = {
        data: `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`,
        sha,
        branch,
        ambiente,
        integracao,
        ...contagem,
        fontesAusentes: fontes.filter((fonte) => !fonte.encontrada).map((fonte) => fonte.origem),
    };

    const linhas = [];
    linhas.push(`# Execução de testes — ${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`);
    linhas.push("");
    linhas.push(`<!-- resumo: ${JSON.stringify(resumoMaquina)} -->`);
    linhas.push("");
    linhas.push("[Voltar ao histórico de execuções](README.md)");
    linhas.push("");
    linhas.push("| Campo | Valor |");
    linhas.push("| --- | --- |");
    linhas.push(`| Situação | ${situacao} |`);
    linhas.push(
        `| Commit | ${urlRepositorio ? `[\`${curto}\`](${urlRepositorio}/commit/${sha})` : `\`${curto}\``} |`,
    );
    linhas.push(`| Branch | \`${celula(branch)}\` |`);
    if (integracao) {
        linhas.push(`| ${integracao.pr ? "Integração" : "Commit"} | ${descreverIntegracao(integracao, urlRepositorio)} |`);
    }
    linhas.push(`| Ambiente | ${urlExecucao ? `${ambiente} — [execução na CI](${urlExecucao})` : ambiente} |`);
    linhas.push(`| Data/hora | ${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}:${p.second} (${FUSO}) |`);
    linhas.push("");

    linhas.push("## Resumo por origem");
    linhas.push("");
    linhas.push("| Origem | Testes | ✅ Passou | ❌ Falhou | ⏭️ Ignorado | ⚠️ Instável | Duração somada |");
    linhas.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: |");
    for (const fonte of fontes) {
        if (!fonte.encontrada) {
            linhas.push(`| ${fonte.origem} | — | — | — | — | — | não executada |`);
            continue;
        }
        const c = contar(testes.filter((teste) => teste.origem === fonte.origem));
        linhas.push(
            `| ${fonte.origem} | ${c.total} | ${c.passou} | ${c.falhou} | ${c.ignorado} | ${c.instavel} | ${formatarDuracao(c.duracaoMs)} |`,
        );
    }
    linhas.push(
        `| **Total** | **${contagem.total}** | **${contagem.passou}** | **${contagem.falhou}** | **${contagem.ignorado}** | **${contagem.instavel}** | **${formatarDuracao(contagem.duracaoMs)}** |`,
    );
    linhas.push("");

    const ausentes = fontes.filter((fonte) => !fonte.encontrada);
    if (ausentes.length > 0) {
        linhas.push("> [!WARNING]");
        linhas.push("> Relatórios não encontrados nesta execução (a suíte não rodou ou não gerou o arquivo):");
        for (const fonte of ausentes) {
            linhas.push(`> - ${fonte.origem}: \`${fonte.caminho}\``);
        }
        linhas.push("");
    }

    linhas.push("## Falhas, testes ignorados e instáveis");
    linhas.push("");
    const destacados = ordenados.filter((teste) => teste.resultado !== "passou");
    if (destacados.length === 0) {
        linhas.push("Nenhum teste falhou, foi ignorado ou precisou de nova tentativa.");
    } else {
        linhas.push("| Suíte | Teste | Resultado | Motivo | Origem |");
        linhas.push("| --- | --- | --- | --- | --- |");
        for (const teste of destacados) {
            linhas.push(
                `| ${celula(teste.suite)} | ${celula(teste.teste)} | ${RESULTADOS[teste.resultado]} | ${celula(teste.motivo, 200) || "—"} | ${teste.origem} |`,
            );
        }
    }
    linhas.push("");

    linhas.push("## Todos os testes");
    linhas.push("");
    if (ordenados.length === 0) {
        linhas.push("Nenhum teste encontrado nos relatórios.");
    } else {
        linhas.push("| Suíte | Teste | Resultado | Duração | Origem |");
        linhas.push("| --- | --- | --- | ---: | --- |");
        for (const teste of ordenados) {
            linhas.push(
                `| ${celula(teste.suite)} | ${celula(teste.teste)} | ${RESULTADOS[teste.resultado]} | ${formatarDuracao(teste.duracaoMs)} | ${teste.origem} |`,
            );
        }
    }
    linhas.push("");
    return linhas.join("\n");
}

/** Nome do arquivo: `AAAA-MM-DD_HH-mm_<sha7>.md`, com sufixo se já existir. */
export function nomeDoArquivo(data, sha, existentes = new Set()) {
    const p = partesDaData(data);
    const base = `${p.year}-${p.month}-${p.day}_${p.hour}-${p.minute}_${sha.slice(0, 7)}`;
    let nome = `${base}.md`;
    for (let i = 2; existentes.has(nome); i += 1) {
        nome = `${base}-${i}.md`;
    }
    return nome;
}

/** Gera o índice `README.md` a partir dos arquivos de execução da pasta. */
export function gerarIndice(pasta, urlRepositorio = "") {
    const contribuicao = path.relative(pasta, path.join(RAIZ, "CONTRIBUTING.md")).replace(/\\/g, "/");
    const nomePasta = path.basename(pasta);
    const descricao =
        nomePasta === "development"
            ? "Cada arquivo registra a execução da CI após uma **integração na `development`** (merge de PR)."
            : nomePasta === "main"
              ? "Cada arquivo registra a execução da CI após um push na **`main`** (versões estáveis)."
              : "Cada arquivo registra uma execução dos testes do projeto.";
    const arquivos = fs
        .readdirSync(pasta)
        .filter((nome) => PADRAO_ARQUIVO.test(nome))
        .sort((a, b) => b.localeCompare(a));
    const linhas = [
        `# Histórico de execuções de testes — \`${nomePasta}\``,
        "",
        "[Voltar aos históricos](../README.md)",
        "",
        `${descricao} Backend, web, E2E e mobile entram no mesmo arquivo,`,
        "com **uma linha por teste** e o resultado de cada um. O nome segue `AAAA-MM-DD_HH-mm_<commit>.md`,",
        `com data e hora em ${FUSO}. Os arquivos são gerados por \`scripts/relatorio-testes/gerar.mjs\`;`,
        `veja o [guia de contribuição](${contribuicao}#relatório-de-execução-dos-testes).`,
        "",
    ];
    if (arquivos.length === 0) {
        linhas.push("Nenhuma execução registrada ainda.", "");
        return linhas.join("\n");
    }
    linhas.push(`**Última execução:** [${arquivos[0].replace(/\.md$/, "")}](${arquivos[0]})`, "");
    linhas.push("| Data/hora | Commit | Integração | Ambiente | Testes | ✅ | ❌ | ⏭️ | ⚠️ | Situação |");
    linhas.push("| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |");
    for (const nome of arquivos) {
        const [, dia, hora, minuto, sha] = nome.match(PADRAO_ARQUIVO);
        const conteudo = fs.readFileSync(path.join(pasta, nome), "utf8");
        const json = conteudo.match(/<!-- resumo: (\{.*\}) -->/)?.[1];
        let r = null;
        try {
            r = json ? JSON.parse(json) : null;
        } catch {
            r = null;
        }
        const [ano, mes, d] = dia.split("-");
        const situacao = !r
            ? "—"
            : r.falhou > 0
              ? "❌ falhas"
              : r.fontesAusentes?.length
                ? `⚠️ sem ${r.fontesAusentes.join(", ")}`
                : r.ignorado + r.instavel > 0
                  ? `✅ sem falhas (${ressalvas(r)})`
                  : "✅ ok";
        linhas.push(
            `| [${d}/${mes}/${ano} ${hora}:${minuto}](${nome}) | \`${sha.slice(0, 7)}\` | ${descreverIntegracao(r?.integracao, urlRepositorio) || "—"} | ${r ? celula(r.ambiente) : "—"} | ${r?.total ?? "—"} | ${r?.passou ?? "—"} | ${r?.falhou ?? "—"} | ${r?.ignorado ?? "—"} | ${r?.instavel ?? "—"} | ${situacao} |`,
        );
    }
    linhas.push("");
    return linhas.join("\n");
}

// ---------------------------------------------------------------------------
// Coleta e CLI
// ---------------------------------------------------------------------------

function git(...args) {
    try {
        return execFileSync("git", args, { cwd: RAIZ, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    } catch {
        return "";
    }
}

function urlDoRepositorio() {
    if (process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY) {
        return `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}`;
    }
    const remoto = git("remote", "get-url", "origin");
    const github = remoto.match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/);
    return github ? `https://github.com/${github[1]}` : "";
}

function lerFonte(chave, caminho) {
    const absoluto = path.resolve(RAIZ, caminho);
    const fonte = { chave, origem: ORIGENS[chave], caminho, encontrada: false, testes: [] };
    if (!fs.existsSync(absoluto)) {
        return fonte;
    }
    if (chave === "backend") {
        const arquivos = fs.statSync(absoluto).isDirectory()
            ? fs
                  .readdirSync(absoluto)
                  .filter((nome) => /^TEST-.*\.xml$/.test(nome))
                  .map((nome) => path.join(absoluto, nome))
            : [absoluto];
        if (arquivos.length === 0) {
            return fonte;
        }
        fonte.testes = arquivos.flatMap((arquivo) => lerJUnit(fs.readFileSync(arquivo, "utf8")));
    } else if (chave === "e2e") {
        fonte.testes = lerPlaywright(fs.readFileSync(absoluto, "utf8"));
    } else {
        const prefixo = chave === "web" ? "web/" : "mobile/";
        fonte.testes = lerJestOuVitest(fs.readFileSync(absoluto, "utf8"), ORIGENS[chave], RAIZ, prefixo);
    }
    fonte.encontrada = true;
    return fonte;
}

const AJUDA = `Uso: node scripts/relatorio-testes/gerar.mjs [opções]

Opções (caminhos relativos à raiz do repositório):
  --backend <pasta|xml>   XML JUnit do Surefire     (padrão: backend/target/surefire-reports)
  --vitest <json>         JSON do Vitest            (padrão: web/test-reports/vitest.json)
  --playwright <json>     JSON do Playwright        (padrão: web/test-reports/playwright.json)
  --jest <json>           JSON do Jest (mobile)     (padrão: mobile/test-reports/jest.json)
  --saida <pasta>         pasta das execuções       (padrão: docs/tests/execucoes/local, ignorada pelo git)
  --sha <commit>          commit testado            (padrão: TEST_REPORT_SHA, GITHUB_SHA ou HEAD)
  --branch <nome>         branch testada            (padrão: TEST_REPORT_BRANCH, GITHUB_REF_NAME ou atual)
  --exigir-todas          termina com erro se algum relatório não for encontrado
  --somente-indice        só regenera o README.md da pasta de saída
  --ajuda                 mostra esta ajuda

Variáveis de ambiente usadas pela CI: TEST_REPORT_MENSAGEM (mensagem do commit testado, para
identificar o PR integrado) e TEST_REPORT_PR (número do PR em revisão).`;

export function lerArgumentos(argv) {
    const opcoes = {
        backend: "backend/target/surefire-reports",
        vitest: "web/test-reports/vitest.json",
        playwright: "web/test-reports/playwright.json",
        jest: "mobile/test-reports/jest.json",
        saida: "docs/tests/execucoes/local",
        sha: "",
        branch: "",
        exigirTodas: false,
        somenteIndice: false,
        ajuda: false,
    };
    const comValor = { "--backend": "backend", "--vitest": "vitest", "--playwright": "playwright", "--jest": "jest", "--saida": "saida", "--sha": "sha", "--branch": "branch" };
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (comValor[arg]) {
            if (argv[i + 1] === undefined) {
                throw new Error(`A opção ${arg} precisa de um valor.`);
            }
            opcoes[comValor[arg]] = argv[++i];
        } else if (arg === "--exigir-todas") {
            opcoes.exigirTodas = true;
        } else if (arg === "--somente-indice") {
            opcoes.somenteIndice = true;
        } else if (arg === "--ajuda" || arg === "-h" || arg === "--help") {
            opcoes.ajuda = true;
        } else {
            throw new Error(`Opção desconhecida: ${arg}`);
        }
    }
    return opcoes;
}

export function main(argv = process.argv.slice(2)) {
    const opcoes = lerArgumentos(argv);
    if (opcoes.ajuda) {
        console.log(AJUDA);
        return 0;
    }
    const pasta = path.resolve(RAIZ, opcoes.saida);
    fs.mkdirSync(pasta, { recursive: true });
    if (opcoes.somenteIndice) {
        fs.writeFileSync(path.join(pasta, "README.md"), gerarIndice(pasta, urlDoRepositorio()));
        console.log(path.relative(RAIZ, path.join(pasta, "README.md")));
        return 0;
    }

    const sha = (opcoes.sha || process.env.TEST_REPORT_SHA || process.env.GITHUB_SHA || git("rev-parse", "HEAD") || "0000000").toLowerCase();
    if (!/^[0-9a-f]{7,40}$/.test(sha)) {
        throw new Error(`Commit inválido: ${sha}`);
    }
    const branch =
        opcoes.branch ||
        process.env.TEST_REPORT_BRANCH ||
        process.env.GITHUB_HEAD_REF ||
        process.env.GITHUB_REF_NAME ||
        git("rev-parse", "--abbrev-ref", "HEAD") ||
        "desconhecida";
    const naCi = process.env.GITHUB_ACTIONS === "true";
    const urlRepositorio = urlDoRepositorio();
    const urlExecucao =
        naCi && process.env.GITHUB_RUN_ID && urlRepositorio
            ? `${urlRepositorio}/actions/runs/${process.env.GITHUB_RUN_ID}`
            : "";

    const fontes = [
        lerFonte("backend", opcoes.backend),
        lerFonte("web", opcoes.vitest),
        lerFonte("e2e", opcoes.playwright),
        lerFonte("mobile", opcoes.jest),
    ];
    const integracao = lerIntegracao(
        process.env.TEST_REPORT_MENSAGEM ?? (naCi ? "" : git("log", "-1", "--format=%B", sha)),
        process.env.TEST_REPORT_PR ?? "",
    );
    const data = new Date();
    const nome = nomeDoArquivo(data, sha, new Set(fs.readdirSync(pasta)));
    const markdown = gerarMarkdown({
        testes: fontes.flatMap((fonte) => fonte.testes),
        fontes,
        sha,
        branch,
        data,
        ambiente: naCi
            ? "CI (GitHub Actions)"
            : git("status", "--porcelain", "--untracked-files=no")
              ? "Local (com alterações não commitadas)"
              : "Local",
        urlRepositorio,
        urlExecucao,
        integracao,
    });
    const destino = path.join(pasta, nome);
    fs.writeFileSync(destino, markdown);
    fs.writeFileSync(path.join(pasta, "README.md"), gerarIndice(pasta, urlRepositorio));

    const relativo = path.relative(RAIZ, destino).replace(/\\/g, "/");
    console.log(relativo);
    for (const fonte of fontes) {
        console.error(
            fonte.encontrada
                ? `  ${fonte.origem}: ${fonte.testes.length} testes`
                : `  ${fonte.origem}: relatório não encontrado em ${fonte.caminho}`,
        );
    }
    if (process.env.GITHUB_OUTPUT) {
        fs.appendFileSync(process.env.GITHUB_OUTPUT, `arquivo=${relativo}\n`);
    }
    const ausentes = fontes.filter((fonte) => !fonte.encontrada);
    if (opcoes.exigirTodas && ausentes.length > 0) {
        console.error(`Relatórios ausentes: ${ausentes.map((fonte) => fonte.origem).join(", ")}`);
        return 1;
    }
    return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        process.exitCode = main();
    } catch (erro) {
        console.error(erro.message);
        process.exitCode = 2;
    }
}
