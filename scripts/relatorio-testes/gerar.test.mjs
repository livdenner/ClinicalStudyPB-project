import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import {
    ORIGENS,
    caminhoRelativo,
    celula,
    descreverIntegracao,
    formatarDuracao,
    gerarIndice,
    gerarMarkdown,
    lerJUnit,
    lerIntegracao,
    lerJestOuVitest,
    lerPlaywright,
    nomeDoArquivo,
    sanitizar,
} from "./gerar.mjs";

const RAIZ = "/home/runner/work/proj/proj";

const JUNIT = `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="br.ufpb.clinicalstudypb.users.UserControllerTest" tests="4">
  <testcase name="deveCriar_CA01_1" classname="br.ufpb.clinicalstudypb.users.UserControllerTest" time="0.123"/>
  <testcase name="deveRetornar409QuandoEmailDuplicado_CA01_2" classname="br.ufpb.clinicalstudypb.users.UserControllerTest" time="1.5">
    <failure message="expected: &lt;409&gt; but was: &lt;200&gt;" type="org.opentest4j.AssertionFailedError">stack</failure>
  </testcase>
  <testcase name="ignorado()" classname="br.ufpb.clinicalstudypb.users.UserControllerTest$Aninhada" time="0">
    <skipped message="desativado temporariamente"/>
  </testcase>
  <testcase name="[1] perfil=ADMIN" classname="br.ufpb.clinicalstudypb.users.UserControllerTest" time="0.01">
    <flakyFailure message="timeout"/>
  </testcase>
</testsuite>`;

const VITEST = {
    testResults: [
        {
            name: `${RAIZ}/web/src/pages/login/login.test.tsx`,
            status: "failed",
            assertionResults: [
                { ancestorTitles: ["Login"], title: "entra com sucesso", status: "passed", duration: 42.4 },
                {
                    ancestorTitles: ["Login", "erros"],
                    title: "mostra erro | senha",
                    status: "failed",
                    duration: 1200,
                    failureMessages: ["\u001b[31mAssertionError\u001b[39m: token=abc123 Bearer eyJa.eyJb.c\nstack"],
                },
                { ancestorTitles: [], title: "pendente", status: "todo", duration: null },
            ],
        },
        { name: `${RAIZ}/web/src/quebrado.test.ts`, status: "failed", message: "SyntaxError: x", assertionResults: [] },
    ],
};

const PLAYWRIGHT = {
    config: { rootDir: `${RAIZ}/web/e2e`, projects: [{ name: "chromium" }] },
    suites: [
        {
            title: "auth/login.spec.ts",
            file: "auth/login.spec.ts",
            specs: [
                {
                    title: "login válido",
                    file: "auth/login.spec.ts",
                    tests: [{ projectName: "chromium", status: "expected", results: [{ status: "passed", duration: 900 }] }],
                },
            ],
            suites: [
                {
                    title: "Fluxo",
                    file: "auth/login.spec.ts",
                    specs: [
                        {
                            title: "instável",
                            file: "auth/login.spec.ts",
                            tests: [
                                {
                                    projectName: "chromium",
                                    status: "flaky",
                                    results: [
                                        { status: "failed", duration: 100, error: { message: "boom" } },
                                        { status: "passed", duration: 200 },
                                    ],
                                },
                            ],
                        },
                        {
                            title: "pulado",
                            file: "auth/login.spec.ts",
                            tests: [
                                {
                                    projectName: "chromium",
                                    status: "skipped",
                                    annotations: [{ type: "skip", description: "sem dados" }],
                                    results: [{ status: "skipped", duration: 0 }],
                                },
                            ],
                        },
                        {
                            title: "quebra",
                            file: "auth/login.spec.ts",
                            tests: [
                                {
                                    projectName: "chromium",
                                    status: "unexpected",
                                    results: [{ status: "failed", duration: 50, error: { message: "Timeout 5000ms\nlinha 2" } }],
                                },
                            ],
                        },
                    ],
                },
            ],
        },
    ],
};

describe("lerJUnit", () => {
    it("gera uma linha por testcase com resultado, duração e motivo", () => {
        const testes = lerJUnit(JUNIT);
        assert.equal(testes.length, 4);
        assert.deepEqual(
            testes.map((t) => [t.suite, t.resultado, t.duracaoMs]),
            [
                ["UserControllerTest", "passou", 123],
                ["UserControllerTest", "falhou", 1500],
                ["UserControllerTest › Aninhada", "ignorado", 0],
                ["UserControllerTest", "instavel", 10],
            ],
        );
        assert.equal(testes[1].motivo, "expected: <409> but was: <200>");
        assert.equal(testes[2].motivo, "desativado temporariamente");
        assert.ok(testes.every((t) => t.origem === ORIGENS.backend));
    });
});

describe("lerJestOuVitest", () => {
    it("lê testes, ancestrais, status e falha de carregamento", () => {
        const testes = lerJestOuVitest(VITEST, ORIGENS.web, RAIZ, "web/");
        assert.deepEqual(
            testes.map((t) => [t.suite, t.teste, t.resultado, t.duracaoMs]),
            [
                ["web/src/pages/login/login.test.tsx", "Login › entra com sucesso", "passou", 42],
                ["web/src/pages/login/login.test.tsx", "Login › erros › mostra erro | senha", "falhou", 1200],
                ["web/src/pages/login/login.test.tsx", "pendente", "ignorado", null],
                ["web/src/quebrado.test.ts", "(falha ao carregar o arquivo de teste)", "falhou", null],
            ],
        );
    });
});

describe("lerJestOuVitest com erro fora dos testes", () => {
    it("registra uma falha quando a execução não teve sucesso mas nenhum teste falhou", () => {
        const dados = {
            success: false,
            testResults: [{ name: `${RAIZ}/web/src/a.test.ts`, status: "passed", assertionResults: [{ title: "ok", status: "passed" }] }],
        };
        const testes = lerJestOuVitest(dados, ORIGENS.web, RAIZ, "web/");
        assert.equal(testes.length, 2);
        assert.equal(testes[1].resultado, "falhou");
        assert.equal(testes[1].suite, "(execução)");
    });
});

describe("lerPlaywright", () => {
    it("percorre suítes aninhadas e trata retry, skip e falha", () => {
        const testes = lerPlaywright(PLAYWRIGHT, RAIZ);
        assert.deepEqual(
            testes.map((t) => [t.suite, t.teste, t.resultado, t.duracaoMs, t.motivo]),
            [
                ["web/e2e/auth/login.spec.ts", "login válido", "passou", 900, ""],
                ["web/e2e/auth/login.spec.ts", "Fluxo › instável", "instavel", 300, "passou na tentativa 2"],
                ["web/e2e/auth/login.spec.ts", "Fluxo › pulado", "ignorado", 0, "test.skip: sem dados"],
                ["web/e2e/auth/login.spec.ts", "Fluxo › quebra", "falhou", 50, "Timeout 5000ms"],
            ],
        );
    });
});

describe("caminhoRelativo", () => {
    it("corta caminhos de outra máquina a partir da pasta da aplicação", () => {
        assert.equal(caminhoRelativo("C:\\Users\\x\\proj\\web\\src\\a.test.ts", "/outra"), "web/src/a.test.ts");
        assert.equal(caminhoRelativo("src/a.test.ts", "/outra", "mobile/"), "mobile/src/a.test.ts");
    });
});

describe("sanitização", () => {
    it("remove tokens, credenciais, CPF e e-mails reais, mantendo e-mails fictícios", () => {
        const texto = sanitizar(
            "Bearer abc.def eyJhbGciOi.eyJzdWIi.sig senha=Segredo123 123.456.789-09 joao@gmail.com pesquisador@clinicalstudypb.test",
        );
        assert.ok(!texto.includes("abc.def"));
        assert.ok(!texto.includes("eyJhbGciOi"));
        assert.ok(!texto.includes("Segredo123"));
        assert.ok(!texto.includes("123.456.789-09"));
        assert.ok(!texto.includes("joao@gmail.com"));
        assert.ok(texto.includes("pesquisador@clinicalstudypb.test"));
    });

    it("escapa pipes e HTML e mantém a célula em uma linha", () => {
        assert.equal(celula("a | b\n<script>"), "a \\| b &lt;script&gt;");
        assert.equal(celula("x".repeat(10), 5), "xxxx…");
    });
});

describe("gerarMarkdown e índice", () => {
    const data = new Date("2026-11-13T19:05:09Z"); // 16:05 em Fortaleza (UTC-3)
    const sha = "abcdef1234567890abcdef1234567890abcdef12";

    it("nomeia o arquivo com data/hora local e commit curto, sem sobrescrever", () => {
        assert.equal(nomeDoArquivo(data, sha), "2026-11-13_16-05_abcdef1.md");
        assert.equal(
            nomeDoArquivo(data, sha, new Set(["2026-11-13_16-05_abcdef1.md"])),
            "2026-11-13_16-05_abcdef1-2.md",
        );
    });

    it("tem uma linha por teste, destaca falhas e registra fontes ausentes", () => {
        const testes = [...lerJUnit(JUNIT), ...lerJestOuVitest(VITEST, ORIGENS.web, RAIZ, "web/")];
        const md = gerarMarkdown({
            testes,
            fontes: [
                { origem: ORIGENS.backend, encontrada: true, caminho: "b" },
                { origem: ORIGENS.web, encontrada: true, caminho: "w" },
                { origem: ORIGENS.e2e, encontrada: false, caminho: "web/test-reports/playwright.json" },
                { origem: ORIGENS.mobile, encontrada: false, caminho: "mobile/test-reports/jest.json" },
            ],
            sha,
            branch: "development",
            data,
            ambiente: "Local",
            urlRepositorio: "https://github.com/org/repo",
            urlExecucao: "",
        });
        const todos = md.split("## Todos os testes")[1];
        const linhasDeTeste = todos.split("\n").filter((l) => l.startsWith("| ") && !l.startsWith("| Suíte") && !l.startsWith("| ---"));
        assert.equal(linhasDeTeste.length, testes.length);
        assert.match(md, /# Execução de testes — 13\/11\/2026 16:05/);
        assert.match(md, /\[`abcdef1`\]\(https:\/\/github\.com\/org\/repo\/commit\/abcdef12/);
        assert.match(md, /\| Situação \| ❌ com falhas \|/);
        assert.match(md, /Web E2E · Playwright: `web\/test-reports\/playwright.json`/);
        assert.match(md, /mostra erro \\\| senha \| ❌ \*\*falhou\*\*/);
        assert.ok(!md.includes("abc123"), "o token da mensagem de falha não pode aparecer");
        assert.ok(!md.includes("\u001b"), "códigos ANSI devem ser removidos");
    });

    it("índice aponta a última execução e lê o resumo de cada arquivo", () => {
        const pasta = fs.mkdtempSync(path.join(os.tmpdir(), "execucoes-"));
        try {
            const fontes = Object.values(ORIGENS).map((origem) => ({ origem, encontrada: true, caminho: "x" }));
            const base = { fontes, sha, branch: "main", ambiente: "CI (GitHub Actions)", urlRepositorio: "", urlExecucao: "" };
            fs.writeFileSync(
                path.join(pasta, "2026-11-12_10-00_1111111.md"),
                gerarMarkdown({ ...base, testes: lerJUnit(JUNIT), data: new Date("2026-11-12T13:00:00Z") }),
            );
            fs.writeFileSync(
                path.join(pasta, "2026-11-13_16-05_abcdef1.md"),
                gerarMarkdown({ ...base, testes: lerJUnit(JUNIT).slice(0, 1), data }),
            );
            fs.writeFileSync(path.join(pasta, "outro.md"), "ignorar");
            const indice = gerarIndice(pasta);
            assert.match(indice, /\*\*Última execução:\*\* \[2026-11-13_16-05_abcdef1\]\(2026-11-13_16-05_abcdef1\.md\)/);
            const linhas = indice.split("\n").filter((l) => l.startsWith("| ["));
            assert.equal(linhas.length, 2);
            assert.match(linhas[0], /13\/11\/2026 16:05.*\| 1 \| 1 \| 0 \| 0 \| 0 \| ✅ ok \|/);
            assert.match(linhas[1], /12\/11\/2026 10:00.*\| 4 \| 1 \| 1 \| 1 \| 1 \| ❌ falhas \|/);
            assert.ok(!indice.includes("outro.md"));
        } finally {
            fs.rmSync(pasta, { recursive: true, force: true });
        }
    });
});

describe("formatarDuracao", () => {
    it("usa ms, segundos com vírgula ou minutos", () => {
        assert.equal(formatarDuracao(null), "—");
        assert.equal(formatarDuracao(999), "999 ms");
        assert.equal(formatarDuracao(1500), "1,50 s");
        assert.equal(formatarDuracao(125_000), "2 min 5 s");
    });
});

describe("integração", () => {
    it("identifica o PR, a branch e o título a partir do merge do GitHub", () => {
        const integracao = lerIntegracao(
            "Merge pull request #79 from livdenner/feat/scheduled-visits-t18-2\n\nImplementa agendamento de visitas (T18.2)\n",
        );
        assert.deepEqual(integracao, {
            pr: 79,
            branch: "feat/scheduled-visits-t18-2",
            titulo: "Implementa agendamento de visitas (T18.2)",
            emRevisao: false,
        });
        assert.equal(
            descreverIntegracao(integracao, "https://github.com/org/repo"),
            "[PR #79](https://github.com/org/repo/pull/79) (`feat/scheduled-visits-t18-2`): Implementa agendamento de visitas (T18.2)",
        );
    });

    it("marca PR em revisão e usa o título do commit quando não há merge", () => {
        assert.deepEqual(lerIntegracao("T25.1: gera relatório", "82"), {
            pr: 82,
            branch: "",
            titulo: "T25.1: gera relatório",
            emRevisao: true,
        });
        assert.equal(descreverIntegracao(lerIntegracao("docs: corrige | tabela")), "docs: corrige \\| tabela");
        assert.equal(lerIntegracao(""), null);
    });

    it("leva a integração ao relatório e ao índice da branch", () => {
        const pasta = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "execucoes-")), "development");
        fs.mkdirSync(pasta);
        try {
            const integracao = lerIntegracao("Merge pull request #81 from org/feat/x\n\nRetirada do participante");
            const md = gerarMarkdown({
                testes: lerJUnit(JUNIT).slice(0, 1),
                fontes: Object.values(ORIGENS).map((origem) => ({ origem, encontrada: true, caminho: "x" })),
                sha: "abcdef1234567",
                branch: "development",
                data: new Date("2026-11-14T18:00:00Z"),
                ambiente: "CI (GitHub Actions)",
                urlRepositorio: "",
                urlExecucao: "",
                integracao,
            });
            assert.match(md, /\| Integração \| PR #81 \(`feat\/x`\): Retirada do participante \|/);
            fs.writeFileSync(path.join(pasta, "2026-11-14_15-00_abcdef1.md"), md);
            const indice = gerarIndice(pasta);
            assert.match(indice, /# Histórico de execuções de testes — `development`/);
            assert.match(indice, /integração na `development`/);
            assert.match(indice, /\| `abcdef1` \| PR #81 \(`feat\/x`\): Retirada do participante \| CI/);
        } finally {
            fs.rmSync(path.dirname(pasta), { recursive: true, force: true });
        }
    });
});
