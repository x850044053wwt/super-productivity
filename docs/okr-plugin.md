# OKR 插件独立维护

OKR 源码在独立 Git 仓库中维护。主项目通过子模块 `packages/plugin-dev/okr` 固定插件提交；应用内置入口、插件保存服务及宿主端 E2E 测试仍由主项目维护。

## 当前本机布局

- 独立仓库：`/Users/Dave/super-productivity-okr`
- 主项目：`/Users/Dave/super-productivity`
- 子模块检出：`packages/plugin-dev/okr`

两个源码目录是同一插件仓库的不同检出，并非自动同步的文件夹。日常修改独立仓库，提交后再更新主项目的子模块。

私有远程仓库：[x850044053wwt/super-productivity-okr](https://github.com/x850044053wwt/super-productivity-okr)。`.gitmodules` 使用 SSH 远程地址，其他机器需要配置拥有该仓库访问权限的 GitHub SSH 身份。

## 修改与验证

在独立仓库中运行：

```sh
cd /Users/Dave/super-productivity-okr
npm test
npm run build
npm run package
```

构建只生成本仓库的 `dist/`，打包生成 `releases/okr-<version>.zip`。均为忽略的构建产物。源码、版本、提交历史由独立仓库管理。

## 更新主项目使用的版本

先在独立仓库完成提交，然后在主项目运行：

```sh
git -C packages/plugin-dev/okr fetch origin
git -C packages/plugin-dev/okr checkout --detach <插件提交SHA>
git add packages/plugin-dev/okr
```

检查主项目差异后，将子模块版本更新与所需的主项目改动一起提交。不要直接编辑 `src/assets/bundled-plugins/okr/`。

完整主项目构建会编译插件，并把插件的 `dist/` 复制到应用资源目录。缺失子模块时可运行：

```sh
git submodule update --init packages/plugin-dev/okr
```

子模块固定的是具体提交，不会自动跟随远程 `main` 更新。请先推送插件提交，再提交主项目的子模块版本更新。

## 安装与兼容

当前主应用保留 `okr` 为内置插件 ID，同 ID ZIP 上传会被拒绝。因此内置版本通过更新子模块、重新构建应用来升级。ZIP 用于没有内置同名插件的兼容宿主。

插件 ID 不变，拆仓不迁移或改写 OKR 数据。之前修复的插件保存完成时机逻辑属于主应用，不会随插件 ZIP 安装到旧版宿主。

## 双月周期（插件 1.1.0）

目标按固定双月周期维护（1–2 月、3–4 月……11–12 月），每个目标带可选字段 `periodId`（周期起始月，如 `2026-09`）。数据格式、字段含义和旧数据处理方式以插件仓库 `README.md` 的“双月周期”一节为准。宿主端 E2E 测试 `e2e/tests/plugins/okr.spec.ts` 覆盖周期切换、跨周期新增和结转。
