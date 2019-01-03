const GitHub = require('github-api')
const { join } = require('path')

const getTreeRecursive = async (repository, treeSha) => {
  const recursiveRequest = await repository._request(
    'GET',
    `/repos/${repository.__fullname}/git/trees/${treeSha}?recursive=1`,
    null
  )
    .then((res) => res.data)

  if (!recursiveRequest.truncated) {
    return recursiveRequest.tree
  }

  const { tree, truncated } = await repository.getTree(treeSha)
    .then((res) => res.data)
  if (truncated) {
    throw new Error(`Tree layer with SHA ${treeSha} exceeded the limit of 100.000 items.`)
  }

  const subTrees = await Promise.all(
    tree
      .filter(({ type }) => type === 'tree')
      .map(async ({ sha, path }) => {
        const tree = await getTreeRecursive(repository, sha)

        return tree.map(({ path: entryPath, ...entry }) => ({
          path: join(path, entryPath),
          ...entry
        }))
      })
  )

  return tree.concat(subTrees)
}

module.exports = async ({ before: shaBefore, after: shaAfter, repositoryName } = {}) => {
  const ghToken = process.env.GITHUB_TOKEN
  const repository = new GitHub(ghToken && {
    token: ghToken
  }).getRepo(repositoryName)

  const [ treeBeforeCommit, treeAfterCommit ] = await Promise.all([
    repository.getCommit(shaBefore),
    repository.getCommit(shaAfter)
  ])
    .then((responses) => responses.map(({ data }) => data))
    .then((commits) => commits.map(({ tree }) => tree.sha))
    .then((treeShas) => Promise.all(
      treeShas.map((treeSha) => getTreeRecursive(repository, treeSha))
    ))

  const packagesFile = treeAfterCommit.find(({ path }) => path === 'packages.json')
  if (!packagesFile) {
    throw new Error('Target repository does not contain "packages.json".')
  }

  const packages = await repository.getBlob(packagesFile.sha)
    .then((res) => res.data)

  const filterTreeByPath = (tree, path) => tree.filter(
    ({ path: filePath }) => filePath.startsWith(path)
  )

  const treeToFileShas = (result, { path, sha }) => {
    result[path] = sha
    return result
  }

  return packages.reduce((changedPackageIndexes, packageDependencyPaths, packageIndex) => {
    const changed = packageDependencyPaths.reduce((changed, path) => {
      if (changed) {
        return true
      }

      const fileShasBeforeCommit = filterTreeByPath(
        treeBeforeCommit,
        path
      ).reduce(treeToFileShas, {})

      const fileShasAfterCommit = filterTreeByPath(
        treeAfterCommit,
        path
      ).reduce(treeToFileShas, {})

      if (filesBeforeCommit.length !== filesAfterCommit.length) {
        return true
      }

      return Object.keys(fileShasAfterCommit).reduce((changed, path) => {
        if (changed) {
          return true
        }

        return fileShasBeforeCommit[path] !== fileShasAfterCommit[path]
      }, false)
    }, false)

    return changed
      ? changedPackageIndexes.concat(packageIndex)
      : changedPackageIndexes
  }, [])
}
