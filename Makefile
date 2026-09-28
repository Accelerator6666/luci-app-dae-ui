# SPDX-License-Identifier: GPL-3.0-only
include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-dae-ui
PKG_VERSION:=0.5.0
PKG_RELEASE:=1
PKG_LICENSE:=GPL-3.0-only

LUCI_TITLE:=Modern LuCI management UI for dae
LUCI_DESCRIPTION:=DAE control plane with local runtime telemetry, capability-aware Native API discovery, visual configuration and verified GeoData updates
LUCI_DEPENDS:=+luci-base +rpcd +ucode +uci +jsonfilter +curl
LUCI_PKGARCH:=all

include $(TOPDIR)/feeds/luci/luci.mk
