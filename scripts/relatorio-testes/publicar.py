#!/usr/bin/env python3
"""Publica como dados o relatório de uma CI concluída, sem executar código da PR.

O índice de cada pasta é gerado pelo `gerar.mjs` deste checkout (o da `main`, confiável),
apontado com `--raiz` para o clone em que o relatório é gravado. Assim todas as pastas de
`docs/test-ci/` mantêm o mesmo formato, com integração, ambiente, ignorados e instáveis.

Não há grupo de concorrência no workflow: execuções simultâneas disputam o push, e quem perde
refaz a publicação a partir da ponta atual (branch do bot) ou desiste sem erro (branch de PR,
onde a próxima CI gera um relatório novo).
"""

import json
import os
from pathlib import Path
import random
import re
import shutil
import subprocess
import sys
import tempfile
import time


ARQUIVO = re.compile(r"^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}_([0-9a-f]{7,40})(?:-\d+)?\.md$")
BASES = {"main", "development"}
PREFIXO_BOT = "ci-reports/"
MENSAGEM = "docs(testes): registra execução "
TENTATIVAS = 5
GERADOR = Path(__file__).resolve().with_name("gerar.mjs")


class PushRecusado(RuntimeError):
    """O remoto recusou o push (branch andou ou o lease expirou)."""


def comando(*args, cwd=None, check=True):
    result = subprocess.run(args, cwd=cwd, encoding="utf-8", capture_output=True, check=False)
    if check and result.returncode:
        raise RuntimeError(f"Falha em {args[0]} {args[1] if len(args) > 1 else ''}: {result.stderr.strip()}")
    return result


def api(route):
    return json.loads(comando("gh", "api", route).stdout)


def aviso(mensagem):
    print(f"::notice::{mensagem}", file=sys.stderr)


def arquivo_relatorio():
    raiz = Path(os.environ["RELATORIO_DIR"])
    arquivos = [p for p in raiz.rglob("*") if p.is_file()]
    if len(arquivos) != 1 or not ARQUIVO.fullmatch(arquivos[0].name):
        raise ValueError("O artefato deve conter exatamente um relatório Markdown com nome válido")
    if arquivos[0].is_symlink() or arquivos[0].stat().st_size > 1_000_000:
        raise ValueError("Relatório inválido ou grande demais")
    return arquivos[0]


def indice(work, pasta_relativa):
    """Regenera `<pasta>/README.md` com o gerador confiável, no formato das outras pastas."""
    if not GERADOR.is_file():
        raise RuntimeError(f"Gerador do índice não encontrado em {GERADOR}; integre a development na main")
    comando("node", str(GERADOR), "--somente-indice", "--raiz", str(work), "--saida", pasta_relativa.as_posix())


def preparar_repo(temporario, repo):
    work = Path(temporario) / "repositorio"
    comando("git", "clone", "--quiet", f"https://github.com/{repo}.git", str(work))
    comando("git", "config", "user.name", os.environ["APP_LOGIN"], cwd=work)
    comando(
        "git",
        "config",
        "user.email",
        os.environ.get("APP_EMAIL", "357421632+clinicalstudypb-ci-reports[bot]@users.noreply.github.com"),
        cwd=work,
    )
    comando("git", "config", "commit.gpgsign", "false", cwd=work)
    return work


def validar_branch(branch):
    if not re.fullmatch(r"[a-zA-Z0-9._/-]+", branch) or ".." in branch or branch.startswith(("-", "/")):
        raise ValueError("Nome de branch inválido")


def ponta(work, branch):
    """Busca a branch no remoto e devolve o SHA da ponta, ou "" se ela não existir."""
    validar_branch(branch)
    fetched = comando("git", "fetch", "--quiet", "origin", f"+refs/heads/{branch}:refs/remotes/origin/{branch}", cwd=work, check=False)
    if fetched.returncode:
        comando("git", "update-ref", "-d", f"refs/remotes/origin/{branch}", cwd=work, check=False)
        return ""
    return comando("git", "rev-parse", f"refs/remotes/origin/{branch}", cwd=work).stdout.strip()


def checkout(work, branch, sha=None):
    if sha is None and not ponta(work, branch):
        return False
    comando("git", "checkout", "--quiet", "-B", "publicacao", sha or f"origin/{branch}", cwd=work)
    return True


def registrar(work, pasta_relativa, arquivo):
    destino = work / pasta_relativa
    destino.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(arquivo, destino / arquivo.name)
    indice(work, pasta_relativa)
    # --force: branches criadas antes do #90 ainda ignoram docs/test-ci/pull-requests/.
    comando("git", "add", "--force", "--", pasta_relativa.as_posix(), cwd=work)
    if comando("git", "diff", "--cached", "--quiet", cwd=work, check=False).returncode:
        comando("git", "commit", "--quiet", "--no-gpg-sign", "-m", f"{MENSAGEM}{arquivo.stem}", cwd=work)
        return True
    return False


def push(work, *args):
    resultado = comando("git", "push", "--quiet", "origin", *args, cwd=work, check=False)
    if resultado.returncode:
        raise PushRecusado(resultado.stderr.strip())


def do_commit(arquivo, sha):
    """O relatório é do commit `sha`? O nome traz o prefixo do SHA testado."""
    return sha.startswith(ARQUIVO.fullmatch(arquivo.name).group(1))


def publicar_pr(work, repo, run, arquivo):
    if run.get("actor", {}).get("login") == os.environ["APP_LOGIN"]:
        return  # CI disparada pelo próprio commit do bot.
    candidatos = run.get("pull_requests") or []
    if not candidatos:
        owner, _ = repo.split("/", 1)
        branch = run.get("head_branch", "")
        candidatos = api(f"repos/{repo}/pulls?state=open&head={owner}:{branch}&per_page=100")
    for candidato in candidatos:
        pr = api(f"repos/{repo}/pulls/{candidato['number']}")
        branch = pr["head"]["ref"]
        if pr["state"] != "open" or pr["base"]["ref"] not in BASES or branch in BASES or branch.startswith(PREFIXO_BOT):
            continue
        if (pr["head"].get("repo") or {}).get("full_name") != repo:
            continue  # PR de fork: o relatório fica só no artefato.
        sha = pr["head"]["sha"]
        if not do_commit(arquivo, sha):
            continue  # A branch mudou enquanto a CI terminava.
        if ponta(work, branch) != sha or not checkout(work, branch, sha=sha):
            return
        ultimo = api(f"repos/{repo}/commits/{sha}")
        arquivos = ultimo.get("files", [])
        if (ultimo["commit"]["message"].startswith(MENSAGEM)
                and arquivos and all(item["filename"].startswith("docs/test-ci/") for item in arquivos)):
            return
        if registrar(work, Path("docs/test-ci/pull-requests") / str(pr["number"]), arquivo):
            try:
                push(work, f"--force-with-lease=refs/heads/{branch}:{sha}", f"HEAD:refs/heads/{branch}")
            except PushRecusado:
                if ponta(work, branch) == sha:
                    raise
                aviso(f"A branch {branch} recebeu um push durante a publicação; a próxima CI gera um relatório novo.")
        return


def pais(work, sha):
    saida = comando("git", "rev-list", "--parents", "-n", "1", sha, cwd=work, check=False).stdout.split()
    return max(len(saida) - 1, 0)


def _pr_so_documentacao(repo, base, sha):
    prs = api(f"repos/{repo}/commits/{sha}/pulls")
    pr = next((item for item in prs if (not base or item["base"]["ref"] == base) and item.get("merged_at")), None)
    if not pr:
        return False
    arquivos_pr = []
    pagina = 1
    while True:
        lote = api(f"repos/{repo}/pulls/{pr['number']}/files?per_page=100&page={pagina}")
        arquivos_pr.extend(lote)
        if len(lote) < 100:
            break
        pagina += 1
    return bool(arquivos_pr) and all(item["filename"].startswith("docs/test-ci/") for item in arquivos_pr)


def so_documentacao(work, sha, repo=None, base=None):
    diferenca = comando("git", "diff", "--name-only", f"{sha}^1", sha, cwd=work, check=False)
    if diferenca.returncode:
        return False
    nomes = diferenca.stdout.splitlines()
    if not nomes or not all(nome.startswith("docs/test-ci/") for nome in nomes):
        return False
    # Em "Rebase and merge", a ponta pode ser só o commit do bot em pull-requests/<n>/:
    # conferimos os arquivos do PR inteiro para não omitir o relatório da integração.
    if pais(work, sha) == 1 and any(nome.startswith("docs/test-ci/pull-requests/") for nome in nomes):
        return bool(repo) and _pr_so_documentacao(repo, base, sha)
    return True


def montar_bot(work, base, bot, arquivo):
    """Monta, sobre a ponta atual da base, um commit com os relatórios pendentes e o novo.

    Devolve o SHA esperado da branch do bot no remoto ("" se não existe) para o lease, ou
    None quando não há nada a publicar.
    """
    esperado = ponta(work, bot)
    pendentes = {}
    if esperado:
        comando("git", "checkout", "--quiet", "-B", "publicacao", f"origin/{bot}", cwd=work)
        pasta = work / "docs/test-ci" / base
        pendentes = {p.name: p.read_bytes() for p in pasta.glob("*.md")
                     if ARQUIVO.fullmatch(p.name) and p.is_file() and not p.is_symlink()}
    if not checkout(work, base):
        return None
    pasta = work / "docs/test-ci" / base
    pasta.mkdir(parents=True, exist_ok=True)
    for nome, conteudo in pendentes.items():
        if not (pasta / nome).exists():
            (pasta / nome).write_bytes(conteudo)
    if not registrar(work, Path("docs/test-ci") / base, arquivo):
        return None
    return esperado


def abrir_pr(repo, base, bot):
    consulta = f"repos/{repo}/pulls?state=open&head={repo.split('/')[0]}:{bot}&base={base}&per_page=100"
    if api(consulta):
        return
    criado = comando("gh", "pr", "create", "--repo", repo, "--base", base, "--head", bot,
                     "--title", f"docs(testes): execuções da CI em {base}",
                     "--body", "Relatórios automáticos de testes. Revise os arquivos em `docs/test-ci/` antes do merge.",
                     check=False)
    if criado.returncode and not api(consulta):  # Outra execução pode ter aberto a PR ao mesmo tempo.
        raise RuntimeError(f"Falha ao abrir a PR do bot: {criado.stderr.strip()}")


def publicar_push(work, repo, run, arquivo, espera=time.sleep):
    base = run.get("head_branch")
    if base not in BASES or not checkout(work, base):
        return
    sha = run["head_sha"]
    if not do_commit(arquivo, sha) or so_documentacao(work, sha, repo=repo, base=base):
        return
    bot = f"{PREFIXO_BOT}{base}"
    for tentativa in range(1, TENTATIVAS + 1):
        esperado = montar_bot(work, base, bot, arquivo)
        if esperado is None:
            return
        try:
            push(work, f"--force-with-lease=refs/heads/{bot}:{esperado}", f"HEAD:refs/heads/{bot}")
            break
        except PushRecusado:
            if tentativa == TENTATIVAS:
                raise
            # Outra execução atualizou a branch do bot: refaz a partir da nova ponta.
            espera(2 ** tentativa + random.random())
    abrir_pr(repo, base, bot)


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
