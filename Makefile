# SPDX-License-Identifier: GPL-3.0-only
include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-dae-ui
PKG_VERSION:=0.7.0
PKG_RELEASE:=1
PKG_LICENSE:=GPL-3.0-only

LUCI_TITLE:=Modern LuCI management UI for dae
LUCI_DESCRIPTION:=DAE control plane with root-only Native API authentication, searchable runtime datasets, visual configuration and verified GeoData updates
LUCI_DEPENDS:=+luci-base +rpcd +ucode +uci +jsonfilter +curl
LUCI_PKGARCH:=all

define Package/$(PKG_NAME)/conffiles
/etc/config/dae-ui
endef

include $(TOPDIR)/feeds/luci/luci.mk

define Package/$(PKG_NAME)/postrm
#!/bin/sh

rm -f "${IPKG_INSTROOT}/etc/dae-ui/native-api.token"
rmdir "${IPKG_INSTROOT}/etc/dae-ui" 2>/dev/null || true

if [ -z "${IPKG_INSTROOT}" ]; then
	rm -rf /tmp/luci-indexcache /tmp/luci-modulecache*
fi

exit 0
endef
