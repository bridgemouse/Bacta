# Vault Setup — Obsidian NFS Mount for MX-4

MX-4 reads Ethan's Obsidian vault via the `readVault` tool. The vault lives on LXC 106 and is served over NFS to LXC 109 where Bacta runs. The mount point is already configured in LXC 109's fstab — this guide covers the LXC 106 side.

**Current status:** Mount is configured but not active. `HEARTBEAT.md` standing orders disable vault reads until this is set up.

---

## What MX-4 Expects

- Mount point on LXC 109: `/mnt/vault`
- NFS source on LXC 106: `/srv/nfs/vault` (or wherever your Obsidian vault lives — symlink if needed)
- File access pattern: `readVault("training/summer-plan.md")` resolves to `/mnt/vault/wiki/training/summer-plan.md`
- Access mode: read-only

The `wiki/` subdirectory is the root MX-4 navigates. Paths passed to `readVault` are relative to `/mnt/vault/wiki/`.

---

## LXC 106 Setup

**1. Install NFS server (if not already installed):**

```bash
apt update && apt install -y nfs-kernel-server
```

**2. Identify your vault path.** This is wherever Obsidian stores the vault on LXC 106. Example: `/home/wheat/vault` or `/data/obsidian/bacta-vault`.

**3. Create the NFS export directory and symlink (if vault is elsewhere):**

```bash
mkdir -p /srv/nfs/vault
# If your vault is at /home/wheat/vault:
ln -s /home/wheat/vault /srv/nfs/vault/wiki
```

The result: `/srv/nfs/vault/wiki/` should contain your Obsidian markdown files.

**4. Configure `/etc/exports`:**

```bash
# Replace 192.168.1.X with LXC 109's actual IP
echo '/srv/nfs/vault 192.168.1.X(ro,sync,no_subtree_check,no_root_squash)' >> /etc/exports
```

Find LXC 109's IP: `grep -r "109" /etc/pve/lxc/ | grep ip` on the Proxmox host, or `ip addr` on LXC 109.

**5. Apply and enable:**

```bash
exportfs -ra
systemctl enable nfs-server
systemctl start nfs-server
```

**6. Verify the export is active:**

```bash
exportfs -v
# Should show: /srv/nfs/vault  192.168.1.X(ro,sync,...)
```

---

## LXC 109 Side (Already Configured)

The fstab entry is already in place:

```
192.168.1.202:/srv/nfs/vault  /mnt/vault  nfs  ro,defaults,_netdev  0  0
```

To mount:

```bash
mount /mnt/vault
```

To verify:

```bash
ls /mnt/vault/wiki/
# Should list your Obsidian folders (training/, health/, etc.)
```

---

## Tell MX-4 the Vault is Ready

Once the mount is active:

1. Remove or update the vault standing orders in `mx4/HEARTBEAT.md` — delete the two lines that disable vault reads and note the inaccessibility.

2. Trigger an orchestrator run to verify: `curl -X POST http://localhost:3001/api/mx4/run`

3. Or tap **SYNC WIKI ›** in AskSheet and ask: "Can you read my training plan?"

---

## Recommended Vault Structure

MX-4 will look for files you tell him to find via `readVault`. These directory names are suggestions — use whatever structure your Obsidian vault already has:

```
wiki/
  training/
    summer-plan.md       ← current training block, mileage targets, race schedule
    history.md           ← past blocks, PRs, injury notes
  health/
    baselines.md         ← personal health baselines MX-4 should know
    context.md           ← anything that affects training (travel, stress, sleep environment)
  journal/
    (optional) daily notes MX-4 can reference for life context
```

The more specific and current the training plan, the more useful MX-4's Training briefings become.
