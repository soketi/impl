/** @type {import('aegir').PartialOptions} */
export default {
    build: {
        config: {
            platform: 'node',
            loader: {
                '.node': 'binary',
            },
        },
    },
}
