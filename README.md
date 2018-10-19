# `github-monorepo-hook`

`github-monorepo-hook` exposes a function which allows you to
simply use `GitHub` web hooks with monorepos.

It detects which packages in your monorepo have been
changed on a push event to allow you to do package specific
operations (like building, publishing etc.).

In addition it supports verification of the events
using the GitHub web hook secret.

## Usage

This is a usage example using an AWS Lambda function behind an
AWS API Gateway:

```js
const getChangedPackages = require('github-monorepo-hook')

const packages = [
  'my-first-package',
  'my-other-package'
]

const options = {
  branch: 'master'
}

exports.handler = async (event) => { // event is an object containing web hook request body and headers
  const changedPackages = await getChangedPackages(
    event,
    packages,
    options
  )

  console.log(changedPackages) // logs an array of the names of the packages which changed with the pushed commits
}
```

### Installation

Install using `npm install github-monorepo-hook`.

### Private Repositories

To use `github-monorepo-hook` with private repositories,
simply set an environment variable called `GITHUB_TOKEN`
to a valid [GitHub access token](https://help.github.com/articles/creating-a-personal-access-token-for-the-command-line/).

### Secret

To enable event verification simply create an environment
variable called `GITHUB_SECRET` containing your secret.
`github-monorepo-hook` will resolve to `false` if the event
failed the verification.
