# Contributing to PlusCraft Launcher

Thank you for your interest in contributing to PlusCraft Launcher! This document provides guidelines and instructions for contributing to the project.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Release Process](#release-process)

## 🤝 Code of Conduct

We are committed to providing a welcoming and inspiring community for all. Please be respectful and constructive in all interactions.

### Our Standards

- Be respectful and inclusive
- Welcome newcomers and help them get started
- Focus on what is best for the community
- Show empathy towards other community members

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ or 20+
- npm 9+
- Git
- For macOS development: CrossOver 25.0.1 or later
- For Linux development: Wine

### Setting Up Your Development Environment

1. **Fork the repository**

    ```bash
    # Click the 'Fork' button on GitHub
    ```

2. **Clone your fork**

    ```bash
    git clone https://github.com/YOUR_USERNAME/launcher.git
    cd launcher
    ```

3. **Add upstream remote**

    ```bash
    git remote add upstream https://github.com/dadwow/launcher.git
    ```

4. **Install dependencies**

    ```bash
    npm install
    ```

5. **Set up environment**

    ```bash
    cp .env.example .env
    # Edit .env with your configuration
    ```

6. **Run the application**
    ```bash
    npm start
    ```

## 🔄 Development Workflow

### Branch Naming Convention

Use descriptive branch names following this pattern:

- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation updates
- `chore/description` - Maintenance tasks
- `refactor/description` - Code refactoring
- `test/description` - Test additions/updates

### Commit Message Convention

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**

- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**

```bash
feat(launcher): add auto-update notification
fix(download): resolve extraction error on Windows
docs(readme): update installation instructions
chore(deps): update electron to v28.0.0
```

### Syncing with Upstream

Keep your fork up to date:

```bash
git fetch upstream
git checkout main
git merge upstream/main
git push origin main
```

## 💻 Coding Standards

### JavaScript/Node.js

- **ESLint**: We use ESLint for code linting

    ```bash
    npm run lint
    ```

- **Prettier**: We use Prettier for code formatting

    ```bash
    npm run format
    ```

- **Code Style**:
    - Use 4 spaces for indentation
    - Use single quotes for strings
    - Add semicolons at the end of statements
    - Keep lines under 100 characters
    - Use meaningful variable and function names
    - Add comments for complex logic

### Best Practices

- Write self-documenting code
- Keep functions small and focused
- Follow the Single Responsibility Principle
- Use async/await for asynchronous operations
- Handle errors appropriately
- Avoid hardcoding values - use configuration

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### Writing Tests

- Write tests for all new features
- Maintain or improve code coverage
- Test edge cases and error conditions
- Use descriptive test names
- Follow the Arrange-Act-Assert pattern

**Example:**

```javascript
describe('DownloadManager', () => {
    it('should successfully download a file', async () => {
        // Arrange
        const url = 'https://example.com/file.zip';
        const destination = '/tmp/file.zip';

        // Act
        const result = await downloadManager.download(url, destination);

        // Assert
        expect(result.success).toBe(true);
        expect(fs.existsSync(destination)).toBe(true);
    });
});
```

## 📝 Submitting Changes

### Before Submitting

1. **Test your changes**

    ```bash
    npm test
    npm run lint
    npm run format:check
    ```

2. **Update documentation** if needed

3. **Add tests** for new features

4. **Update CHANGELOG.md** (for significant changes)

### Creating a Pull Request

1. **Push your changes**

    ```bash
    git push origin feature/your-feature-name
    ```

2. **Create a Pull Request** on GitHub
    - Use a clear, descriptive title
    - Fill out the PR template completely
    - Link related issues
    - Add screenshots for UI changes
    - Request review from maintainers

3. **Respond to feedback**
    - Address reviewer comments
    - Push additional commits if needed
    - Keep the discussion professional

### Pull Request Checklist

- [ ] Code follows the project's coding standards
- [ ] All tests pass (`npm test`)
- [ ] Linting passes (`npm run lint`)
- [ ] Code is properly formatted (`npm run format`)
- [ ] New tests added for new features
- [ ] Documentation updated if needed
- [ ] Commit messages follow conventions
- [ ] PR description is clear and complete

## 🚀 Release Process

Releases are automated through GitHub Actions:

### Creating a Release

1. **Manual Release** (Recommended):

    ```bash
    # Update version in package.json
    npm version patch  # or minor, or major

    # Push the tag
    git push --tags
    ```

2. **Automatic Versioning**:
    - The CI/CD pipeline will automatically build and release when a tag is pushed
    - Tags should follow semantic versioning: `v1.2.3`

### Version Numbering

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR** version: Breaking changes
- **MINOR** version: New features (backward compatible)
- **PATCH** version: Bug fixes (backward compatible)

## 🔍 Code Review Process

### For Contributors

- Be patient - reviews may take time
- Be open to feedback
- Respond promptly to comments
- Keep discussions focused on the code

### For Reviewers

- Be respectful and constructive
- Explain the reasoning behind suggestions
- Approve PRs that meet standards
- Request changes when needed

## 🆘 Getting Help

- **Issues**: Check [existing issues](https://github.com/dadwow/launcher/issues)
- **Discussions**: Start a [discussion](https://github.com/dadwow/launcher/discussions)
- **Documentation**: Read the [docs](docs/)

## 📄 License

By contributing, you agree that your contributions will be licensed under the same license as the project (MIT License).

## 🙏 Recognition

Contributors will be recognized in:

- The project README
- Release notes
- GitHub contributors page

---

Thank you for contributing to PlusCraft Launcher! 🎉
