const jwt = require("jsonwebtoken")
const cookie = require("cookie")
const bcrypt = require("bcryptjs")

const log = true

addEventListener('fetch', event => {
  return event.respondWith(handleRequest(event.request))
})

/**
 * Respond with hello worker text
 * @param {Request} request
 */
async function handleRequest(request) {
  let errorStatusCode = 500
  try {
    // Expect the user logs in by passing the email and password
    // in as the JSON body of the request
    const body = await request.json()
    const { email, password } = body
    log && console.log(`Login request - email: ${email}  pass: ${password}`)

    // Try to fetch the user object, if it is not found then 
    // return error (401 Unauthorized)
    const user = await fetchUser(email)
    log && console.log('Fetched user: ', user)
    if (user == null) {
      errorStatusCode = 401
      throw new Error(`Invalid password or email`)
    }

    // Compare the password, if it doesn't match the found 
    // user object then return error (401 Unauthorized)
    const matches = await bcrypt.compare(password, user.password)
    log && console.log('Password matches!')
    if (!matches) {
      errorStatusCode = 401
      throw new Error(`Invalid password or email`)
    }
    
    // Enhance the user object with hasura specific claims
    const hasuraUser = await addHasuraClaims(user)

    // Create a JWT and serialize as a secure http-only cookie
    const jwtCookie = await createJwtCookie(hasuraUser)

    // Finally respond to the caller with the JWT cookie and 
    // basic user object in the body as JSON
    //return new Response(JSON.stringify({ id: user.id, email: user.email }), {
    return new Response(JSON.stringify(hasuraUser), {
      status: 200,
      headers: {
        "Set-Cookie": jwtCookie,
        "Content-Type": "application/json",
      }
    })
  } catch (error) {
    log && console.log('Error: ', error.message)
    // Convert any thrown exceptions to an error response
    return new Response(JSON.stringify({error: error.message}), {
      status: errorStatusCode,
      headers: {
        "Content-Type": "application/json",
      }
    })
  }
}


/*
 * Lookup a user object using the email passed in
 * on the body of the reqest
 */
async function fetchUser(email) {
  console.log(`fetchUser: ${email}`)

  let user = null

  // The following uses HTTPBin to mock a real networked call
  // to get our mockup user for testing. This allows us to test
  // with some meaningful network latency since the run time
  // constraints in Workers is so tight.
  const url = `https://httpbin.org/anything`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      id: 1,
      email: 'test@home.com',
      password: '$2y$10$WUjDkHIXnIWgXbryTkXVk.C2d5kknKBzSsz4laty7t1.6Y.aioJMe',
      //pass is qwerty123
      name: 'Rob Newton',
      nickname: "Rob",
      picture: "https://www.gravatar.com/avatar/205e460b479e2e5b48aec07710c08d50?f=y",
      roles: ['admin','user'],
      role: 'admin'
    }),
  })
  
  const { headers } = response
  const contentType = headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    user = (await response.json()).json
  }

  return user
}


/*
 * Add the Hasura specific namespaced claims to the
 * user object
 */
async function addHasuraClaims(user) {
  let userWithHasuraClaims = user
  userWithHasuraClaims['https://hasura.io/jwt/claims'] = {
    'x-hasura-allowed-roles': user.roles,
    'x-hasura-default-role': user.role,
    'x-hasura-user-id': user.id,
  }
  return userWithHasuraClaims
}


/*
 * Generate a JWT with the user ID and email as the payload,
 * then serialize to a secure HTTP-only cookie.
 */
async function createJwtCookie(payload) {
  const secretKey = await KV_SECRETS.get("jwtRS256.key")

  const token = jwt.sign(payload, secretKey, {
    algorithm: "RS256",
    expiresIn: "15m",
  })

  const jwtCookie = cookie.serialize("jwt", token, {
    secure: true,
    httpOnly: true,
    path: "/",
  })

  return jwtCookie
}