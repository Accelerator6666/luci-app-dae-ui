# SPDX-License-Identifier: GPL-3.0-only
include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-dae-ui
PKG_VERSION:=0.2.0
PKG_RELEASE:=1
PKG_LICENSE:=GPL-3.0-only

LUCI_TITLE:=Modern LuCI management UI for dae
LUCI_DESCRIPTION:=Multi-file dae configuration, local code editor, policy views, backups, diagnostics and future native API integration
LUCI_DEPENDS:=+luci-base +rpcd +ucode +uci +jsonfilter
LUCI_PKGARCH:=all

include $(TOPDIR)/feeds/luci/luci.mk
