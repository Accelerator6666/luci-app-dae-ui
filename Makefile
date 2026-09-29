# SPDX-License-Identifier: GPL-3.0-only
include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-dae-ui
PKG_VERSION:=0.12.0
PKG_RELEASE:=1
PKG_LICENSE:=GPL-3.0-only

LUCI_TITLE:=Modern LuCI management UI for dae
LUCI_DESCRIPTION:=DAE control plane with traffic/DNS rule dictionaries, generation-safe flow drill-down, capability-driven probes and visual configuration
LUCI_DEPENDS:=+luci-base +rpcd +ucode +uci +jsonfilter +curl +ca-bundle +unzip
LUCI_PKGARCH:=all

define Package/$(PKG_NAME)/conffiles
/etc/config/dae-ui
endef

include $(TOPDIR)/feeds/luci/luci.mk

define Package/$(PKG_NAME)/postinst
#!/bin/sh

chmod 0755 "${IPKG_INSTROOT}/usr/libexec/dae-ui/dae-runner" 2>/dev/null || true
chmod 0755 "${IPKG_INSTROOT}/usr/libexec/dae-ui/version-boot-guard" 2>/dev/null || true
chmod 0755 "${IPKG_INSTROOT}/etc/init.d/dae-ui-version" 2>/dev/null || true

if [ -z "${IPKG_INSTROOT}" ] && [ "$(uci -q get dae-ui.main.version_manager_enabled)" = "1" ]; then
	/etc/init.d/dae-ui-version enable >/dev/null 2>&1 || true
	/usr/libexec/dae-ui/version-boot-guard prepare >/dev/null 2>&1 || true
fi

exit 0
endef

define Package/$(PKG_NAME)/postrm
#!/bin/sh

rm -f "${IPKG_INSTROOT}/etc/dae-ui/native-api.token"
rmdir "${IPKG_INSTROOT}/etc/dae-ui" 2>/dev/null || true

if [ -z "${IPKG_INSTROOT}" ]; then
	if [ -L /usr/bin/dae ] && [ "$(readlink /usr/bin/dae 2>/dev/null)" = "/usr/libexec/dae-ui/dae-runner" ] && [ -x /usr/lib/dae-ui/versions/system/dae ]; then
		rm -f /usr/bin/dae
		cp -p /usr/lib/dae-ui/versions/system/dae /usr/bin/dae
		chmod 0755 /usr/bin/dae
	fi
	/etc/init.d/dae-ui-version disable >/dev/null 2>&1 || true
	rm -rf /tmp/luci-indexcache /tmp/luci-modulecache*
fi

exit 0
endef
