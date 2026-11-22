/**
 * Cloudflare Worker for the RTU Tindahan frontend.
 *
 * Workers static assets serve everything in ./dist for free and without a
 * request quota. This script only runs for paths that are not files, and its
 * one job is to relay the Django backend at the same origin as the page:
 *
 *   /api/*     -> API_ORIGIN/api/*
 *   /admin/*   -> API_ORIGIN/admin/*
 *   /static/*  -> API_ORIGIN/static/*
 *
 * Keeping the API on the page's own origin means no CORS preflights, no
 * cross-site cookie rules, and no tunnel hostname baked into the JS bundle.
 * The upstream address lives in wrangler.jsonc (or a dashboard variable), so
 * rotating the tunnel costs one variable change, not a rebuild.
 */

const PROXY_PREFIXES = /^\/(api|admin|static)(\/|$)/

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (!PROXY_PREFIXES.test(url.pathname)) {
      return env.ASSETS.fetch(request)
    }

    const origin = (env.API_ORIGIN || '').replace(/\/+$/, '')
    if (!origin) {
      return new Response('API_ORIGIN is not configured', { status: 500 })
    }

    // Host must be re-derived by fetch() for the upstream, not forwarded.
    const headers = new Headers(request.headers)
    headers.delete('host')

    const init = {
      method: request.method,
      headers,
      redirect: 'manual', // let Django's 302s (admin login etc.) reach the browser
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      init.body = request.body
    }

    const upstream = await fetch(origin + url.pathname + url.search, init)

    // fetch() hands back a decoded body, so the original encoding headers lie.
    const out = new Headers(upstream.headers)
    out.delete('content-encoding')
    out.delete('content-length')

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: out,
    })
  },
}
