#!/usr/bin/env python3
"""One-time Railway bootstrap for the stage environment.

Creates the Railway project, one service that runs backend/Dockerfile (serving
the mobile app, the desktop dashboard and the API from one origin), pins it to
Singapore (Railway's config-as-code file is deprecated, so this script is the
infrastructure definition), gives it a public domain and an uploads volume, sets its variables,
and stores what GitHub Actions needs (RAILWAY_TOKEN secret, STAGE_URL variable)
so pushes to Stage deploy automatically.

Requires:
  RAILWAY_ACCOUNT_TOKEN   an account or workspace token from https://railway.com/account/tokens
  GH_TOKEN                a GitHub token with repo scope (to store the secret/variable)
  DATABASE_URL            the Supabase connection string (percent-encoded password)

Everything here is idempotent enough to re-run: it reuses a project/service with
the same name if one exists, and re-upserts variables.
"""
from __future__ import annotations

import base64
import json
import os
import secrets
import sys
import urllib.request

RAILWAY_API = "https://backboard.railway.com/graphql/v2"
PROJECT = os.environ.get("RAILWAY_PROJECT", "omnischool-stage")
SERVICE = os.environ.get("RAILWAY_SERVICE", "omnischool")
ENVIRONMENT = os.environ.get("RAILWAY_ENVIRONMENT", "stage")
REGION = os.environ.get("RAILWAY_REGION", "asia-southeast1-eqsg3a")   # Singapore
GH_REPO = os.environ.get("GH_REPO", "EduveraIITA/Eduvera")


def need(name: str) -> str:
    v = os.environ.get(name)
    if not v:
        sys.exit(f"{name} is required")
    return v


def gql(query: str, variables: dict | None = None) -> dict:
    req = urllib.request.Request(
        RAILWAY_API,
        data=json.dumps({"query": query, "variables": variables or {}}).encode(),
        headers={
            "Authorization": f"Bearer {need('RAILWAY_ACCOUNT_TOKEN')}",
            "Content-Type": "application/json",
            "User-Agent": "omnischool-bootstrap/1.0",   # Railway's edge rejects the default urllib agent
        },
    )
    try:
        with urllib.request.urlopen(req) as r:
            body = json.loads(r.read())
    except urllib.error.HTTPError as e:  # type: ignore[attr-defined]
        raise RuntimeError(f"HTTP {e.code}: {e.read().decode(errors='replace')[:400]}") from None
    if body.get("errors"):
        raise RuntimeError(json.dumps(body["errors"], indent=1))
    return body["data"]


def gh(method: str, path: str, body: dict | None = None) -> tuple[int, dict]:
    req = urllib.request.Request(
        "https://api.github.com" + path,
        data=json.dumps(body).encode() if body is not None else None,
        method=method,
        headers={
            "Authorization": f"Bearer {need('GH_TOKEN')}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, (json.loads(r.read() or b"{}") if r.status != 204 else {})
    except urllib.error.HTTPError as e:  # type: ignore[attr-defined]
        return e.code, json.loads(e.read() or b"{}")


# ---------------------------------------------------------------- project + environment
def find_or_create_project() -> tuple[str, str]:
    # Works with both account tokens and workspace tokens (the latter cannot query `me`).
    data = gql("""query { projects { edges { node { id name environments { edges { node { id name } } } } } } }""")
    for edge in data["projects"]["edges"]:
        node = edge["node"]
        if node["name"] == PROJECT:
            envs = {e["node"]["name"]: e["node"]["id"] for e in node["environments"]["edges"]}
            env_id = envs.get(ENVIRONMENT) or next(iter(envs.values()))
            print(f"project exists: {PROJECT} ({node['id']}) · environment {env_id}")
            return node["id"], env_id
    data = gql(
        """mutation($input: ProjectCreateInput!) { projectCreate(input: $input) { id environments { edges { node { id name } } } } }""",
        {"input": {"name": PROJECT, "defaultEnvironmentName": ENVIRONMENT}},
    )
    proj = data["projectCreate"]
    env_id = proj["environments"]["edges"][0]["node"]["id"]
    print(f"project created: {PROJECT} ({proj['id']}) · environment {env_id}")
    return proj["id"], env_id


def find_or_create_service(project_id: str) -> str:
    data = gql("""query($id: String!) { project(id: $id) { services { edges { node { id name } } } } }""", {"id": project_id})
    for edge in data["project"]["services"]["edges"]:
        if edge["node"]["name"] == SERVICE:
            print(f"service exists: {SERVICE} ({edge['node']['id']})")
            return edge["node"]["id"]
    data = gql(
        """mutation($input: ServiceCreateInput!) { serviceCreate(input: $input) { id } }""",
        {"input": {"projectId": project_id, "name": SERVICE}},
    )
    print(f"service created: {SERVICE} ({data['serviceCreate']['id']})")
    return data["serviceCreate"]["id"]


def configure_service(service_id: str, env_id: str) -> None:
    """Region, Dockerfile and health check live on the service instance.
    railway.json config-as-code is deprecated, so this is the source of truth."""
    settings = {
        "multiRegionConfig": {REGION: {"numReplicas": 1}},   # a JSON scalar: keys are region ids
        "dockerfilePath": "backend/Dockerfile",              # setting this selects the Docker builder
        "healthcheckPath": "/readyz",
        "healthcheckTimeout": 180,
        "restartPolicyType": "ON_FAILURE",
        "restartPolicyMaxRetries": 5,
    }
    for key, value in settings.items():
        try:
            gql(
                """mutation($s: String!, $e: String!, $input: ServiceInstanceUpdateInput!) { serviceInstanceUpdate(serviceId: $s, environmentId: $e, input: $input) }""",
                {"s": service_id, "e": env_id, "input": {key: value}},
            )
        except RuntimeError as e:
            print(f"could not set {key} ({e.splitlines()[0][:90]})")
    print(f"service configured: region {REGION}, backend/Dockerfile, /readyz")


def ensure_domain(project_id: str, service_id: str, env_id: str) -> str:
    data = gql(
        """query($p: String!, $s: String!, $e: String!) { domains(projectId: $p, serviceId: $s, environmentId: $e) { serviceDomains { domain } } }""",
        {"p": project_id, "s": service_id, "e": env_id},
    )
    existing = data["domains"]["serviceDomains"]
    if existing:
        print(f"domain exists: {existing[0]['domain']}")
        return existing[0]["domain"]
    data = gql(
        """mutation($input: ServiceDomainCreateInput!) { serviceDomainCreate(input: $input) { domain } }""",
        {"input": {"serviceId": service_id, "environmentId": env_id, "targetPort": 8000}},
    )
    print(f"domain created: {data['serviceDomainCreate']['domain']}")
    return data["serviceDomainCreate"]["domain"]


def ensure_volume(project_id: str, service_id: str, env_id: str) -> None:
    data = gql("""query($id: String!) { project(id: $id) { volumes { edges { node { id name } } } } }""", {"id": project_id})
    if data["project"]["volumes"]["edges"]:
        print("volume exists")
        return
    try:
        gql(
            """mutation($input: VolumeCreateInput!) { volumeCreate(input: $input) { id } }""",
            {"input": {"projectId": project_id, "environmentId": env_id, "serviceId": service_id, "mountPath": "/app/storage/leave-documents", "region": REGION}},
        )
        print("volume created at /app/storage/leave-documents")
    except RuntimeError as e:
        print(f"could not create volume automatically ({e.splitlines()[0][:80]}); uploads are ephemeral until one is added")


def set_variables(project_id: str, service_id: str, env_id: str, public_url: str) -> None:
    variables = {
        "DATABASE_URL": need("DATABASE_URL"),
        "COOKIE_SECRET": secrets.token_hex(32),
        "COOKIE_SECURE": "true",
        "TRUST_PROXY": "true",
        "ALLOWED_ORIGINS": public_url,
        "PUBLIC_URL": public_url,
        "DEMO_MODE": "true",
        "SEED_DEMO": "false",
        "DEMO_PASSWORD": "OmniDemo@2026",
        "RATE_LIMIT_STORE": "postgres",
        "AI_PROVIDER": "mock",
        "LOG_LEVEL": "info",
        "DATABASE_POOL_MAX": "5",
    }
    gql(
        """mutation($input: VariableCollectionUpsertInput!) { variableCollectionUpsert(input: $input) }""",
        {"input": {"projectId": project_id, "environmentId": env_id, "serviceId": service_id, "variables": variables}},
    )
    print(f"variables set ({len(variables)})")


def project_token(project_id: str, env_id: str) -> str:
    data = gql(
        """mutation($input: ProjectTokenCreateInput!) { projectTokenCreate(input: $input) }""",
        {"input": {"projectId": project_id, "environmentId": env_id, "name": "github-actions"}},
    )
    print("project token created for GitHub Actions")
    return data["projectTokenCreate"]


def store_in_github(token: str, public_url: str) -> None:
    from nacl import encoding, public  # PyNaCl

    _, key = gh("GET", f"/repos/{GH_REPO}/actions/secrets/public-key")
    box = public.SealedBox(public.PublicKey(key["key"].encode(), encoding.Base64Encoder()))
    sealed = base64.b64encode(box.encrypt(token.encode())).decode()
    st, _ = gh("PUT", f"/repos/{GH_REPO}/actions/secrets/RAILWAY_TOKEN", {"encrypted_value": sealed, "key_id": key["key_id"]})
    print("GitHub secret RAILWAY_TOKEN", "stored" if st in (201, 204) else st)
    for name, value in (("STAGE_URL", public_url), ("RAILWAY_SERVICE", SERVICE)):
        st, _ = gh("PATCH", f"/repos/{GH_REPO}/actions/variables/{name}", {"name": name, "value": value})
        if st == 404:
            st, _ = gh("POST", f"/repos/{GH_REPO}/actions/variables", {"name": name, "value": value})
        print(f"GitHub variable {name} = {value}", "stored" if st in (201, 204) else st)


def main() -> None:
    project_id, env_id = find_or_create_project()
    service_id = find_or_create_service(project_id)
    configure_service(service_id, env_id)
    domain = ensure_domain(project_id, service_id, env_id)
    public_url = f"https://{domain}"
    ensure_volume(project_id, service_id, env_id)
    set_variables(project_id, service_id, env_id, public_url)
    token = project_token(project_id, env_id)
    store_in_github(token, public_url)
    print()
    print(f"Done. Push to Stage (or run the workflow) and the site appears at {public_url}")
    print(f"  mobile   {public_url}/")
    print(f"  desktop  {public_url}/staff/")
    print(f"  api      {public_url}/api/docs")


if __name__ == "__main__":
    main()
