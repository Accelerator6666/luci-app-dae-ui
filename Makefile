# SPDX-License-Identifier: GPL-3.0-only
include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-dae-ui
PKG_VERSION:=0.14.2
PKG_RELEASE:=1
PKG_LICENSE:=GPL-3.0-only
PKG_BUILD_DEPENDS:=luci-base/host

include $(INCLUDE_DIR)/package.mk

define Package/luci-app-dae-ui
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=3. Applications
  TITLE:=Modern LuCI management UI for dae
  DEPENDS:=+dae +luci-base +rpcd +rpcd-mod-ucode +ucode +uci +jsonfilter +curl +ca-bundle +unzip
  PKGARCH:=all
endef

define Package/luci-app-dae-ui/description
 DAE control plane with persistent safe binary version switching,
 traffic and DNS diagnostics, capability-driven probes and visual
 configuration.
endef

define Package/luci-app-dae-ui/conffiles
/etc/config/dae-ui
endef

define Build/Configure
endef

define Build/Compile
	$(STAGING_DIR_HOSTPKG)/bin/po2lmo \
		$(CURDIR)/po/zh_Hans/dae-ui.po \
		$(PKG_BUILD_DIR)/dae-ui.zh-cn.lmo
endef

define Package/luci-app-dae-ui/install
	$(INSTALL_DIR) $(1)/www
	$(CP) ./htdocs/* $(1)/www/

	$(INSTALL_DIR) $(1)/
	$(CP) ./root/* $(1)/

	$(INSTALL_DIR) $(1)/usr/lib/lua/luci/i18n
	$(INSTALL_DATA) $(PKG_BUILD_DIR)/dae-ui.zh-cn.lmo \
		$(1)/usr/lib/lua/luci/i18n/dae-ui.zh-cn.lmo

	chmod 0755 $(1)/usr/libexec/dae-ui/dae-runner
	chmod 0755 $(1)/usr/libexec/dae-ui/version-boot-guard
	chmod 0755 $(1)/etc/init.d/dae-ui-version
endef

define Package/luci-app-dae-ui/postinst
#!/bin/sh

chmod 0755 "$${IPKG_INSTROOT}/usr/libexec/dae-ui/dae-runner" 2>/dev/null || true
chmod 0755 "$${IPKG_INSTROOT}/usr/libexec/dae-ui/version-boot-guard" 2>/dev/null || true
chmod 0755 "$${IPKG_INSTROOT}/etc/init.d/dae-ui-version" 2>/dev/null || true

if [ -z "$${IPKG_INSTROOT}" ]; then
	rm -f /tmp/luci-indexcache.*
	rm -rf /tmp/luci-modulecache/
	/etc/init.d/rpcd reload >/dev/null 2>&1 || true

	if [ "$$(uci -q get dae-ui.main.version_manager_enabled)" = "1" ]; then
		/etc/init.d/dae-ui-version enable >/dev/null 2>&1 || true
		/usr/libexec/dae-ui/version-boot-guard prepare >/dev/null 2>&1 || true
	fi
fi

exit 0
endef

define Package/luci-app-dae-ui/postrm
#!/bin/sh

rm -f "${IPKG_INSTROOT}/etc/dae-ui/native-api.token"
rm -f "${IPKG_INSTROOT}/etc/dae-ui/geodata-pins"
rmdir "${IPKG_INSTROOT}/etc/dae-ui" 2>/dev/null || true

if [ -z "$${IPKG_INSTROOT}" ]; then
	if [ -L /usr/bin/dae ] && [ "$$(readlink /usr/bin/dae 2>/dev/null)" = "/usr/libexec/dae-ui/dae-runner" ] && [ -x /usr/lib/dae-ui/versions/system/dae ]; then
		rm -f /usr/bin/dae
		cp -p /usr/lib/dae-ui/versions/system/dae /usr/bin/dae
		chmod 0755 /usr/bin/dae
	fi

	/etc/init.d/dae-ui-version disable >/dev/null 2>&1 || true
	rm -f /tmp/luci-indexcache.*
	rm -rf /tmp/luci-modulecache/
	/etc/init.d/rpcd reload >/dev/null 2>&1 || true
fi

exit 0
endef

$(eval $(call BuildPackage,luci-app-dae-ui))
