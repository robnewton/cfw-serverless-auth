.. meta::
   :description: Serverless Authentication Running on Cloudflare Workers and Cache
   :keywords: edge, workers, cloudflare, authentication, JWT, hasura, serverless, cdn, react, spa, jamstack

Serverless Authentication Running on Cloudflare Workers and Cache
===

.. contents:: Table of contents
  :backlinks: none
  :depth: 1
  :local:

UPDATE - Doesn't Work
---
While technically this compiles and runs successfully, the password hashing proves too CPU intensive a task to perform in the allotted CPU time available (10ms free and 50ms bundled). As is usually the case when I have an idea if something will work it takes trying it and failing to find teh silver bullet online posting that could have told me the answer in the first place. In this case, that URL is below.

- https://community.cloudflare.com/t/options-for-password-hashing/138077/11


Introduction
---
The basic idea is to do authentication (login) in a Cloudflare Worker in the CDN edge using JS referencing a user database table in the database through GraphQL using the Hasura admin secret.

**Caveat**
This is just an idea. I don't know if it will work but I want to take a few minutes to try it out. I already use Auth0 and know that this is reinventing a wheel, but I am always looking for simplicity in the stack.

**Origin (Why)**
Apple recently changed their policy on third party cookies and it caused our implementation of Auth0 Lock in the React apps to stop working on Apple devices. After login they would never redirect back to the site with the JWT token.

I searched a while and all of the solutions to get around these lack of support for 3rd party cookies didn't work. I've tried upgrading Lock, changing Auth0 settings, and nothing seemed to work. I know the underlying process is simple so I just got frustrated and wanted to get rid of all of the complexity and confusion that comes from misleading and outdated documentation and advice online around the Auth0 platform and just develop a simple authentication system myself.

The Workers
---
The following workers would be developed and deployed onto the Cloudflare CDN as JS workers.

**Signup** - create a new user.

**Login** - check user and pass params against GraphQL users endpoint. If valid, use KV to get the stored private key then use it to mint a new jwt plus refresh token. Write refresh token into cache with same expiry as refresh token.

**Logout** - set jwt expiry to 1970 and delete refresh token from cache.

**JWKS** - get the public key to validate with.

**Refresh** - check refresh token against cache. If found and valid, generate new jwt and refresh. Delete old refresh token from cache. Add new refresh token into cache. Match cache expiry with token expiry.

Upon refresh, extra security would be to delete a refresh token from the cache if it needs to be blacklisted. If the refresh endpoint knows the passed in token is valid but does not find it in the cache then it responds as if it is not valid assuming it’s a blacklisted refresh token.

Costs
---
Since we can have up to 100k worker requests per day on the free plan, we can likely not have to pay for authentication.

- https://developers.cloudflare.com/workers/platform/limits

Resources
---
- https://hasura.io/blog/best-practices-of-using-jwt-with-graphql/#basics_client_setup_expiration
- https://developers.cloudflare.com/workers/learning/how-the-cache-works
- https://developers.cloudflare.com/workers/examples/cache-api
- https://developers.cloudflare.com/workers/runtime-apis/kv
- https://github.com/cloudflare/wrangler-action

Extra Credit
---
If this ends up working well, I wonder if it would make sense to throw a simplistic UI overtop of it that can manage users and allow an admin to black list refresh tokens.