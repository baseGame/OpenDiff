# Release workflow patch for Windows portable

Add after Tauri bundles (windows job):

```yaml
      - name: Build and upload Windows portable zip
        if: matrix.platform == 'windows-latest'
        shell: pwsh
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          $zip = & pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/windows/package-portable.ps1 -SkipBuild
          if (-not (Test-Path -LiteralPath $zip)) { throw "Portable zip missing: $zip" }
          gh release upload $env:GITHUB_REF_NAME $zip --clobber --repo $env:GITHUB_REPOSITORY
          Write-Host "Uploaded $zip"
```

Prune filter: add zip and portable to isInstallerArtifact.
