# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.2.x   | :white_check_mark: |
| < 0.2   | :x:                |

## Security Considerations

### Credential Storage

**Important:** prjsync stores NocoDB API tokens in **plain text** in the
configuration file:

```
~/.prjsync/config.json
```

This is a known limitation of the current implementation. The token is not
encrypted and can be read by anyone with access to this file.

### Protecting Your Credentials

To minimize security risks:

1. **Set restrictive file permissions:**
   ```bash
   chmod 600 ~/.prjsync/config.json
   chmod 700 ~/.prjsync
   ```

2. **Never commit your configuration file to version control**

3. **Use tokens with minimal permissions** - Only grant the NocoDB token access
   to the specific table you're syncing

4. **Rotate tokens regularly** - Generate new tokens periodically in NocoDB
   settings

5. **Be aware of backups** - Home directory backups will include your API token

For detailed security recommendations, see the
[Configuration Security Guide](docs/reference/configuration.md#security-considerations).

### macOS-Specific Considerations

prjsync runs on macOS and uses AppleScript to interact with Things 3. This
means:

- The tool requires permission to control Things 3 via System Events
- You should only run prjsync from trusted sources
- Review the source code before granting these permissions

## Reporting a Vulnerability

If you discover a security vulnerability in prjsync, please report it
responsibly:

### What to Report

- Security vulnerabilities in the codebase
- Issues with credential handling or storage
- Potential data exposure risks
- Authentication or authorization bypasses

### How to Report

**Please DO NOT open a public GitHub issue for security vulnerabilities.**

Instead, please report security issues via one of these methods:

1. **GitHub Security Advisories** (preferred):
   - Go to the [Security tab](../../security/advisories)
   - Click "Report a vulnerability"
   - Fill out the private vulnerability report form

2. **Direct contact** (if Security Advisories is unavailable):
   - Create a new issue with the title "Security: [Brief Description]"
   - In the body, state "I have a security concern and would like to be
     contacted privately"
   - DO NOT include vulnerability details in the issue
   - A maintainer will reach out to you privately

### What to Expect

1. **Acknowledgment**: You'll receive a response within 48 hours acknowledging
   receipt of your report

2. **Investigation**: The maintainer will investigate the issue and determine
   its severity

3. **Resolution**: Security vulnerabilities will be addressed in the following
   priority order:
   - Critical: Within 7 days
   - High: Within 14 days
   - Medium: Within 30 days
   - Low: Next scheduled release

4. **Disclosure**: Once a fix is available:
   - A security advisory will be published
   - Credit will be given to the reporter (unless anonymity is requested)
   - Users will be notified to update

### Out of Scope

The following are not considered security vulnerabilities:

- Issues requiring physical access to the user's computer
- Social engineering attacks
- Issues in third-party dependencies (report to upstream projects)
- Features working as documented (e.g., tokens stored in plain text)

## Security Best Practices for Users

### For Individual Use

- Run prjsync only on your personal, trusted computer
- Use FileVault (macOS disk encryption) to protect your home directory
- Don't share your `~/.prjsync/` directory or config file
- Revoke NocoDB tokens when no longer needed

### For Team/Organizational Use

- Create separate NocoDB service accounts for each user
- Use NocoDB tokens with table-level permissions only
- Implement token rotation policies
- Monitor NocoDB audit logs for unexpected activity
- Consider network-level restrictions on NocoDB API access

## Future Security Improvements

The following security enhancements are planned for future releases:

- [ ] Environment variable support for API tokens
- [ ] Integration with macOS Keychain for secure credential storage
- [ ] Encrypted configuration file with user-provided passphrase
- [ ] Support for OAuth/SSO authentication flows
- [ ] Audit logging of all sync operations

## Additional Resources

- [Configuration Security Guide](docs/reference/configuration.md#security-considerations)
- [Getting Started Tutorial](docs/tutorials/getting-started.md)
- [Troubleshooting Guide](docs/how-to/troubleshooting.md)

---

**Last Updated:** 2025-10-10
