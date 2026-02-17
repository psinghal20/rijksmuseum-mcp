export function isSearchArtworkArguments(args) {
    if (!args || typeof args !== 'object')
        return false;
    const params = args;
    // Check types of optional parameters if they exist
    if (params.title !== undefined && typeof params.title !== 'string')
        return false;
    if (params.objectNumber !== undefined && typeof params.objectNumber !== 'string')
        return false;
    if (params.creator !== undefined && typeof params.creator !== 'string')
        return false;
    if (params.creationDate !== undefined && typeof params.creationDate !== 'string')
        return false;
    if (params.description !== undefined && typeof params.description !== 'string')
        return false;
    if (params.type !== undefined && typeof params.type !== 'string')
        return false;
    if (params.technique !== undefined && typeof params.technique !== 'string')
        return false;
    if (params.material !== undefined && typeof params.material !== 'string')
        return false;
    if (params.aboutActor !== undefined && typeof params.aboutActor !== 'string')
        return false;
    if (params.imageAvailable !== undefined && typeof params.imageAvailable !== 'boolean')
        return false;
    if (params.pageToken !== undefined && typeof params.pageToken !== 'string')
        return false;
    // At least one search parameter should be provided
    return !!(params.title || params.objectNumber || params.creator || params.creationDate ||
        params.description || params.type || params.technique || params.material ||
        params.aboutActor || params.imageAvailable !== undefined);
}
export function isOpenImageArguments(args) {
    if (!args || typeof args !== 'object')
        return false;
    const { imageUrl } = args;
    return typeof imageUrl === 'string' && imageUrl.startsWith('http');
}
