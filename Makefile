# SPDX-License-Identifier: GPL-3.0-only
#
# Copyright (C) 2022 ImmortalWrt.org
# Copyright (C) 2026 Ser9ei

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-zerotier
PKG_MAINTAINER:=Ser9ei <it4notice@proton.me>
PKG_LICENSE:=GPL-3.0-only
PKG_VERSION:=1.1.1
PKG_RELEASE:=1
PKG_PO_VERSION:=$(PKG_VERSION)-r$(PKG_RELEASE)

LUCI_TITLE:=LuCI for ZeroTier
LUCI_URL:=https://github.com/Ser9ei/luci-app-zerotier/
LUCI_DESCRIPTION:=Provides Web UI for ZeroTier Service.
LUCI_DEPENDS:=+zerotier

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
