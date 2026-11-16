#!/usr/bin/env python3
"""Publica como dados o relatório de uma CI concluída, sem executar código da PR."""

import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile


ARQUIVO = re.compile(r"^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}_([0-9a-f]{7,40})(?:-\d+)?\.md$")
BASES = {"main", "development"}


def comando(*args, cwd=None, check=True):
    result = subprocess.run(args, cwd=cwd, text=True, capture_output=True, check=False)
    if check and result.returncode:
        raise RuntimeError(f"Falha em {args[0]} {args[1] if len(args) > 1 else ''}: {result.stderr.strip()}")
    return result


def api(route):
    return json.loads(comando("gh", "api", route).stdout)


def arquivo_relatorio():
    raiz = Path(os.environ["RELATORIO_DIR"])
    arquivos = [p for p in raiz.rglob("*") if p.is_file()]
    if len(arquivos) != 1 or not ARQUIVO.fullmatch(arquivos[0].name):
        raise ValueError("O artefato deve conter exatamente um relatório Markdown com nome válido")
    if arquivos[0].is_symlink() or arquivos[0].stat().st_size > 1_000_000:
        raise ValueError("Relatório inválido ou grande demais")
    return arquivos[0]


def indice(pasta):
    nomes = sorted((p.name for p in pasta.glob("*.md") if ARQUIVO.fullmatch(p.name)), reverse=True)
    volta = "../../README.md" if pasta.parent.name == "pull-requests" else "../README.md"
    linhas = [f"# Histórico de execuções de testes — `{pasta.name}`", "", f"[Voltar aos históricos]({volta})", ""]
    if not nomes:
        linhas += ["Nenhuma execução registrada ainda.", ""]
    else:
        linhas += [f"**Última execução:** [{nomes[0][:-3]}]({nomes[0]})", "", "| Execução | Commit | Testes | Passaram | Falharam |", "| --- | --- | ---: | ---: | ---: |"]
        for nome in nomes:
            conteudo = (pasta / nome).read_text(encoding="utf-8")
            resumo = re.search(r"<!-- resumo: (\{[^\n]*\}) -->", conteudo)
            dados = json.loads(resumo.group(1)) if resumo else {}
            sha = ARQUIVO.fullmatch(nome).group(1)
            linhas.append(f"| [{nome[:-3]}]({nome}) | `{sha[:7]}` | {dados.get('total', '—')} | {dados.get('passou', '—')} | {dados.get('falhou', '—')} |")
        linhas.append("")
    (pasta / "README.md").write_text("\n".join(linhas), encoding="utf-8")


def preparar_repo(temporario, repo):
    work = Path(temporario) / "repositorio"
    comando("git", "clone", "--quiet", f"https://github.com/{repo}.git", str(work))
    comando("git", "config", "user.name", os.environ["APP_LOGIN"], cwd=work)
    comando("git", "config", "user.email", "github-actions[bot]@users.noreply.github.com", cwd=work)
    comando("git", "config", "commit.gpgsign", "false", cwd=work)
    return work


def checkout(work, branch):
    if not re.fullmatch(r"[a-zA-Z0-9._/-]+", branch) or ".." in branch or branch.startswith(("-", "/")):
        raise ValueError("Nome de branch inválido")
    fetched = comando("git", "fetch", "origin", f"refs/heads/{branch}:refs/remotes/origin/{branch}", cwd=work, check=False)
    if fetched.returncode:
        return False
    comando("git", "checkout", "-B", "publicacao", f"origin/{branch}", cwd=work)
    return True


def registrar(work, pasta_relativa, arquivo):
    destino = work / pasta_relativa
    destino.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(arquivo, destino / arquivo.name)
    indice(destino)
    comando("git", "add", "--", str(pasta_relativa), cwd=work)
    if comando("git", "diff", "--cached", "--quiet", cwd=work, check=False).returncode:
        comando("git", "commit", "--no-gpg-sign", "-m", f"docs(testes): registra execução {arquivo.stem}", cwd=work)
        return True
    return False


def publicar_pr(work, repo, run, arquivo):
    if run.get("actor", {}).get("login") == os.environ["APP_LOGIN"]:
        return
    candidatos = run.get("pull_requests") or []
    if not candidatos:
        owner, _ = repo.split("/", 1)
        branch = run.get("head_branch", "")
        candidatos = api(f"repos/{repo}/pulls?state=open&head={owner}:{branch}&per_page=100")
    for candidato in candidatos:
        pr = api(f"repos/{repo}/pulls/{candidato['number']}")
        branch = pr["head"]["ref"]
        if pr["state"] != "open" or pr["base"]["ref"] not in BASES or branch in BASES or branch.startswith("ci-reports/"):
            continue
        if pr["head"]["repo"]["full_name"] != repo or not arquivo.name.endswith(".md"):
            continue
        if not arquivo.name.split("_")[-1].startswith(pr["head"]["sha"][:7]):
            continue  # A branch mudou enquanto a CI terminava.
        if not checkout(work, branch):
            return
        ultimo = api(f"repos/{repo}/commits/{pr['head']['sha']}")
        arquivos = ultimo.get("files", [])
        if (ultimo["commit"]["message"].startswith("docs(testes): registra execução ")
                and arquivos and all(item["filename"].startswith("docs/test-ci/") for item in arquivos)):
            return
        if registrar(work, Path("docs/test-ci/pull-requests") / str(pr["number"]), arquivo):
            comando("git", "push", "origin", f"HEAD:refs/heads/{branch}", cwd=work)
        return


def so_documentacao(work, sha):
    diferenca = comando("git", "diff", "--name-only", f"{sha}^1", sha, cwd=work, check=False)
    if diferenca.returncode:
        return False
    nomes = diferenca.stdout.splitlines()
    return bool(nomes) and all(nome.startswith("docs/test-ci/") for nome in nomes)


def publicar_push(work, repo, run, arquivo):
    base = run.get("head_branch")
    if base not in BASES or not checkout(work, base):
        return
    sha = run["head_sha"]
    if not arquivo.name.split("_")[-1].startswith(sha[:7]) or so_documentacao(work, sha):
        return
    bot = f"ci-reports/{base}"
    pendentes = {}
    if checkout(work, bot):
        pasta = work / "docs/test-ci" / base
        pendentes = {p.name: p.read_bytes() for p in pasta.glob("*.md") if ARQUIVO.fullmatch(p.name) and p.is_file() and not p.is_symlink()}
    comando("git", "checkout", "-B", "publicacao", f"origin/{base}", cwd=work)
    pasta = work / "docs/test-ci" / base
    pasta.mkdir(parents=True, exist_ok=True)
    for nome, conteudo in pendentes.items():
        if not (pasta / nome).exists():
            (pasta / nome).write_bytes(conteudo)
    if not registrar(work, Path("docs/test-ci") / base, arquivo):
        return
    comando("git", "push", "--force-with-lease", "origin", f"HEAD:refs/heads/{bot}", cwd=work)
    prs = api(f"repos/{repo}/pulls?state=open&head={repo.split('/')[0]}:{bot}&base={base}&per_page=100")
    if not prs:
        comando("gh", "pr", "create", "--repo", repo, "--base", base, "--head", bot,
                "--title", f"docs(testes): execuções da CI em {base}",
                "--body", "Relatórios automáticos de testes. Revise os arquivos em `docs/test-ci/` antes do merge.")


def main():
    repo = os.environ["GITHUB_REPOSITORY"]
    evento = json.loads(Path(os.environ["GITHUB_EVENT_PATH"]).read_text(encoding="utf-8"))
    run = evento["workflow_run"]
    if run["event"] not in {"pull_request", "push"} or run["repository"]["full_name"] != repo:
        return
    arquivo = arquivo_relatorio()
    with tempfile.TemporaryDirectory() as temporario:
        work = preparar_repo(temporario, repo)
        if run["event"] == "pull_request":
            publicar_pr(work, repo, run, arquivo)
        else:
            publicar_push(work, repo, run, arquivo)


if __name__ == "__main__":
    main()
